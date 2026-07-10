import { Pool, PoolClient } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface DbMethods {
  get<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
  all<T = any>(sql: string, params?: any[]): Promise<T[]>;
  run(sql: string, params?: any[]): Promise<{ id?: number; rowCount: number }>;
}

interface FullDb extends DbMethods {
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: DbMethods) => Promise<T>): Promise<T>;
}

function clientMethods(client: PoolClient): DbMethods {
  return {
    async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
      return (await client.query(sql, params)).rows[0] as T | undefined;
    },
    async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
      return (await client.query(sql, params)).rows as T[];
    },
    async run(sql: string, params: any[] = []): Promise<{ id?: number; rowCount: number }> {
      const r = await client.query(sql, params);
      return { id: r.rows[0]?.id != null ? Number(r.rows[0].id) : undefined, rowCount: r.rowCount ?? 0 };
    },
  };
}

export const db: FullDb = {
  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return (await pool.query(sql, params)).rows[0] as T | undefined;
  },
  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return (await pool.query(sql, params)).rows as T[];
  },
  async run(sql: string, params: any[] = []): Promise<{ id?: number; rowCount: number }> {
    const r = await pool.query(sql, params);
    return { id: r.rows[0]?.id != null ? Number(r.rows[0].id) : undefined, rowCount: r.rowCount ?? 0 };
  },
  async exec(sql: string): Promise<void> {
    await pool.query(sql);
  },
  async transaction<T>(fn: (tx: DbMethods) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(clientMethods(client));
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
};

export async function initDb() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'technician' CHECK(role IN ('admin','technician','receptionist')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      updated_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      whatsapp TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      total_spent NUMERIC NOT NULL DEFAULT 0,
      total_services INTEGER NOT NULL DEFAULT 0,
      last_service_date TEXT,
      created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      updated_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );
    CREATE TABLE IF NOT EXISTS vehicles (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER,
      plate TEXT,
      color TEXT,
      fuel TEXT CHECK(fuel IN ('gasolina','etanol','flex','diesel','gnv','eletrico','hibrido')),
      mileage INTEGER,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS services (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price NUMERIC NOT NULL,
      estimated_duration INTEGER,
      category TEXT,
      vehicle_type TEXT DEFAULT 'todos' CHECK(vehicle_type IN ('todos','hatch','sedan','suv','pickup','van','moto','caminhao')),
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
      appointment_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'agendado' CHECK(status IN ('agendado','confirmado','em_andamento','concluido','cancelado')),
      discount NUMERIC DEFAULT 0,
      final_price NUMERIC,
      observations TEXT,
      created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );
    CREATE TABLE IF NOT EXISTS appointment_services (
      id SERIAL PRIMARY KEY,
      appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      service_id INTEGER NOT NULL REFERENCES services(id),
      UNIQUE(appointment_id, service_id)
    );
    CREATE TABLE IF NOT EXISTS order_services (
      id SERIAL PRIMARY KEY,
      appointment_id INTEGER NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
      before_photos TEXT DEFAULT '[]',
      after_photos TEXT DEFAULT '[]',
      checklist TEXT DEFAULT '{}',
      observations TEXT,
      payment_method TEXT CHECK(payment_method IN ('dinheiro','cartao_credito','cartao_debito','pix','transferencia')),
      technician TEXT,
      signature TEXT
    );
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT,
      supplier TEXT,
      purchase_price NUMERIC,
      sale_price NUMERIC,
      stock NUMERIC NOT NULL DEFAULT 0,
      minimum_stock NUMERIC NOT NULL DEFAULT 0,
      unit TEXT DEFAULT 'un'
    );
    CREATE TABLE IF NOT EXISTS product_usage (
      id SERIAL PRIMARY KEY,
      appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity NUMERIC NOT NULL
    );
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id),
      movement_type TEXT NOT NULL CHECK(movement_type IN ('entrada','saida','ajuste')),
      quantity NUMERIC NOT NULL,
      reason TEXT,
      appointment_id INTEGER REFERENCES appointments(id),
      created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );
    CREATE TABLE IF NOT EXISTS financial_transactions (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('receita','despesa')),
      category TEXT,
      description TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      date TEXT NOT NULL,
      appointment_id INTEGER REFERENCES appointments(id),
      payment_method TEXT CHECK(payment_method IN ('dinheiro','cartao_credito','cartao_debito','pix','transferencia')),
      created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('reminder_1d','reminder_15d','reminder_30d','reminder_45d','loyalty','system')),
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );
    CREATE TABLE IF NOT EXISTS feedback (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      appointment_id INTEGER REFERENCES appointments(id),
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );
    CREATE TABLE IF NOT EXISTS loyalty_cards (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
      total_washes INTEGER NOT NULL DEFAULT 0,
      current_stamp_count INTEGER NOT NULL DEFAULT 0,
      free_washes_earned INTEGER NOT NULL DEFAULT 0,
      free_washes_used INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );
    CREATE INDEX IF NOT EXISTS idx_appointments_customer ON appointments(customer_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
    CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
    CREATE INDEX IF NOT EXISTS idx_appointment_services_apt ON appointment_services(appointment_id);
    CREATE INDEX IF NOT EXISTS idx_appointment_services_svc ON appointment_services(service_id);
    CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON vehicles(customer_id);
    CREATE INDEX IF NOT EXISTS idx_financial_date ON financial_transactions(date);
    CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_movements(product_id);
  `);

  const adminExists = await db.get("SELECT id FROM users WHERE email = $1", ["admin@eltongarage.com"]);
  if (!adminExists) {
    const hash = bcrypt.hashSync("admin123", 10);
    await db.run(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)",
      ["Administrador", "admin@eltongarage.com", hash, "admin"]
    );
  }

  await seedDemoData();
}

async function seedDemoData() {
  const row = await db.get<{ c: string }>("SELECT COUNT(*) as c FROM customers");
  if (Number(row?.c ?? 0) > 0) return;

  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = (d: Date) => d.toISOString().split("T")[0];

  const c1 = await db.run("INSERT INTO customers (name,phone,whatsapp,email,total_spent,total_services) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", ["Carlos Mendonca","(11) 98765-4321","(11) 98765-4321","carlos@email.com",1250.0,5]);
  const c2 = await db.run("INSERT INTO customers (name,phone,whatsapp,email,total_spent,total_services) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", ["Maria Aparecida Silva","(11) 91234-5678","(11) 91234-5678","maria@email.com",890.0,3]);
  const c3 = await db.run("INSERT INTO customers (name,phone,whatsapp,email,total_spent,total_services) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", ["Roberto Ferreira","(11) 99876-5432","(11) 99876-5432","roberto@email.com",2100.0,8]);

  const v1 = await db.run("INSERT INTO vehicles (customer_id,brand,model,year,plate,color,fuel) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id", [c1.id,"Toyota","Corolla",2021,"ABC-1234","Prata","flex"]);
  const v2 = await db.run("INSERT INTO vehicles (customer_id,brand,model,year,plate,color,fuel) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id", [c2.id,"Honda","Civic",2020,"DEF-5678","Preto","gasolina"]);
  const v3 = await db.run("INSERT INTO vehicles (customer_id,brand,model,year,plate,color,fuel) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id", [c3.id,"Volkswagen","Amarok",2022,"GHI-9012","Branco","diesel"]);

  const s1 = await db.run("INSERT INTO services (name,description,price,estimated_duration,category,vehicle_type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", ["Lavagem Completa","Lavagem externa e interna completa",80.0,60,"Lavagem","todos"]);
  const s2 = await db.run("INSERT INTO services (name,description,price,estimated_duration,category,vehicle_type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", ["Polimento Simples","Polimento com maquina de 1 passo",250.0,180,"Polimento","todos"]);
  const s3 = await db.run("INSERT INTO services (name,description,price,estimated_duration,category,vehicle_type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", ["Higienizacao Interna","Limpeza e higienizacao do interior",350.0,240,"Higienizacao","todos"]);
  const s4 = await db.run("INSERT INTO services (name,description,price,estimated_duration,category,vehicle_type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", ["Vitrificacao","Vitrificacao de pintura com garantia de 1 ano",800.0,480,"Protecao","todos"]);
  const s5 = await db.run("INSERT INTO services (name,description,price,estimated_duration,category,vehicle_type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", ["Cristalizacao de Vidros","Tratamento de vidros com produto hidrofobico",120.0,90,"Vidros","todos"]);

  await db.run("INSERT INTO products (name,brand,supplier,purchase_price,sale_price,stock,minimum_stock,unit) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", ["Shampoo Automotivo","Meguiars","Distribuidora Auto",35.0,60.0,15,5,"un"]);
  await db.run("INSERT INTO products (name,brand,supplier,purchase_price,sale_price,stock,minimum_stock,unit) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", ["Cera Carnauba","Vonixx","Distribuidora Auto",45.0,80.0,8,3,"un"]);
  await db.run("INSERT INTO products (name,brand,supplier,purchase_price,sale_price,stock,minimum_stock,unit) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", ["Microfibra Premium","Autoamerica","Distribuidora Auto",12.0,25.0,3,10,"un"]);
  await db.run("INSERT INTO products (name,brand,supplier,purchase_price,sale_price,stock,minimum_stock,unit) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", ["Polidor de Corte","Meguiars","Distribuidora Auto",55.0,95.0,6,2,"un"]);

  const a1 = await db.run("INSERT INTO appointments (customer_id,vehicle_id,appointment_date,status,final_price) VALUES ($1,$2,$3,$4,$5) RETURNING id", [c1.id,v1.id,tomorrow.toISOString(),"agendado",80.0]);
  const a2 = await db.run("INSERT INTO appointments (customer_id,vehicle_id,appointment_date,status,final_price) VALUES ($1,$2,$3,$4,$5) RETURNING id", [c2.id,v2.id,now.toISOString(),"em_andamento",600.0]);
  const a3 = await db.run("INSERT INTO appointments (customer_id,vehicle_id,appointment_date,status,final_price) VALUES ($1,$2,$3,$4,$5) RETURNING id", [c3.id,v3.id,yesterday.toISOString(),"concluido",920.0]);

  await Promise.all([
    db.run("INSERT INTO appointment_services (appointment_id,service_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [a1.id,s1.id]),
    db.run("INSERT INTO appointment_services (appointment_id,service_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [a2.id,s2.id]),
    db.run("INSERT INTO appointment_services (appointment_id,service_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [a2.id,s3.id]),
    db.run("INSERT INTO appointment_services (appointment_id,service_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [a3.id,s4.id]),
    db.run("INSERT INTO appointment_services (appointment_id,service_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [a3.id,s5.id]),
    db.run("INSERT INTO loyalty_cards (customer_id,total_washes,current_stamp_count) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [c1.id,5,5]),
    db.run("INSERT INTO loyalty_cards (customer_id,total_washes,current_stamp_count) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [c2.id,3,3]),
    db.run("INSERT INTO loyalty_cards (customer_id,total_washes,current_stamp_count) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [c3.id,8,8]),
  ]);

  await db.run("INSERT INTO financial_transactions (type,category,description,amount,date,appointment_id,payment_method) VALUES ($1,$2,$3,$4,$5,$6,$7)", ["receita","Servicos","Vitrificacao, Cristalizacao de Vidros - Roberto Ferreira",920.0,dateStr(yesterday),a3.id,"pix"]);
  await db.run("INSERT INTO notifications (customer_id,title,message,type) VALUES ($1,$2,$3,$4)", [c1.id,"Lembrete de Agendamento","Carlos Mendonca tem agendamento amanha.","reminder_1d"]);
  await db.run("INSERT INTO feedback (customer_id,appointment_id,rating,comment) VALUES ($1,$2,$3,$4)", [c3.id,a3.id,5,"Excelente servico! Carro ficou como novo."]);
}
