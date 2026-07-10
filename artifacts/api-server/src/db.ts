import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "..", "elton_garage.db");

export const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'technician' CHECK(role IN ('admin', 'technician', 'receptionist')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      whatsapp TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      total_spent REAL NOT NULL DEFAULT 0,
      total_services INTEGER NOT NULL DEFAULT 0,
      last_service_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER,
      plate TEXT,
      color TEXT,
      fuel TEXT CHECK(fuel IN ('gasolina','etanol','flex','diesel','gnv','eletrico','hibrido')),
      mileage INTEGER,
      notes TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      estimated_duration INTEGER,
      category TEXT,
      vehicle_type TEXT DEFAULT 'todos' CHECK(vehicle_type IN ('todos','hatch','sedan','suv','pickup','van','moto','caminhao')),
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      vehicle_id INTEGER NOT NULL,
      appointment_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'agendado' CHECK(status IN ('agendado','confirmado','em_andamento','concluido','cancelado')),
      discount REAL DEFAULT 0,
      final_price REAL,
      observations TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    );

    CREATE TABLE IF NOT EXISTS appointment_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      UNIQUE(appointment_id, service_id),
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES services(id)
    );

    CREATE TABLE IF NOT EXISTS order_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL UNIQUE,
      before_photos TEXT DEFAULT '[]',
      after_photos TEXT DEFAULT '[]',
      checklist TEXT DEFAULT '{}',
      observations TEXT,
      payment_method TEXT CHECK(payment_method IN ('dinheiro','cartao_credito','cartao_debito','pix','transferencia')),
      technician TEXT,
      signature TEXT,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      brand TEXT,
      supplier TEXT,
      purchase_price REAL,
      sale_price REAL,
      stock REAL NOT NULL DEFAULT 0,
      minimum_stock REAL NOT NULL DEFAULT 0,
      unit TEXT DEFAULT 'un'
    );

    CREATE TABLE IF NOT EXISTS product_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      movement_type TEXT NOT NULL CHECK(movement_type IN ('entrada','saida','ajuste')),
      quantity REAL NOT NULL,
      reason TEXT,
      appointment_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    );

    CREATE TABLE IF NOT EXISTS financial_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('receita','despesa')),
      category TEXT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      appointment_id INTEGER,
      payment_method TEXT CHECK(payment_method IN ('dinheiro','cartao_credito','cartao_debito','pix','transferencia')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('reminder_1d','reminder_15d','reminder_30d','reminder_45d','loyalty','system')),
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      appointment_id INTEGER,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    );

    CREATE TABLE IF NOT EXISTS loyalty_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL UNIQUE,
      total_washes INTEGER NOT NULL DEFAULT 0,
      current_stamp_count INTEGER NOT NULL DEFAULT 0,
      free_washes_earned INTEGER NOT NULL DEFAULT 0,
      free_washes_used INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
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

  // Seed admin user if not exists
  const adminExists = db.prepare("SELECT id FROM users WHERE email = ?").get("admin@eltongarage.com");
  if (!adminExists) {
    const hash = bcrypt.hashSync("admin123", 10);
    db.prepare(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)"
    ).run("Administrador", "admin@eltongarage.com", hash, "admin");
  }

  seedDemoData();
}

/**
 * Runs once on startup to migrate databases created before the many-to-many
 * appointment_services schema. Detects the old service_id column on appointments,
 * copies its data to appointment_services, then recreates the table without it.
 *
 * NOTE: PRAGMA foreign_keys cannot be changed inside a transaction (it is silently
 * ignored by SQLite). This function therefore performs the schema change outside any
 * explicit transaction wrapper, bracketing only with the pragma.
 */
export function runMigrations() {
  // Check if appointments still has service_id column
  const cols = db.pragma("table_info(appointments)") as Array<{ name: string }>;
  const hasServiceId = cols.some((c) => c.name === "service_id");
  if (!hasServiceId) return; // Already migrated

  console.log("[migration] Detected legacy service_id column — migrating to appointment_services...");

  // Must be set OUTSIDE any active transaction — SQLite ignores this pragma inside BEGIN/COMMIT
  db.pragma("foreign_keys = OFF");

  try {
    // Step 1: ensure junction table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS appointment_services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER NOT NULL,
        service_id INTEGER NOT NULL,
        UNIQUE(appointment_id, service_id),
        FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
        FOREIGN KEY (service_id) REFERENCES services(id)
      );
    `);

    // Step 2: copy existing service_id rows → junction table
    db.prepare(`
      INSERT OR IGNORE INTO appointment_services (appointment_id, service_id)
      SELECT id, service_id FROM appointments WHERE service_id IS NOT NULL
    `).run();

    // Step 3: Recreate appointments without service_id using SQLite's rename/copy/drop/rename pattern
    // (ALTER TABLE DROP COLUMN is only available in SQLite 3.35+; rename pattern is safest)
    db.exec(`
      CREATE TABLE appointments_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        vehicle_id INTEGER NOT NULL,
        appointment_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'agendado' CHECK(status IN ('agendado','confirmado','em_andamento','concluido','cancelado')),
        discount REAL DEFAULT 0,
        final_price REAL,
        observations TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
      );

      INSERT INTO appointments_new (id, customer_id, vehicle_id, appointment_date, status, discount, final_price, observations, created_at)
      SELECT id, customer_id, vehicle_id, appointment_date, status, discount, final_price, observations, created_at
      FROM appointments;

      DROP TABLE appointments;
      ALTER TABLE appointments_new RENAME TO appointments;

      CREATE INDEX IF NOT EXISTS idx_appointments_customer ON appointments(customer_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
      CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
      CREATE INDEX IF NOT EXISTS idx_appointment_services_apt ON appointment_services(appointment_id);
      CREATE INDEX IF NOT EXISTS idx_appointment_services_svc ON appointment_services(service_id);
    `);
  } finally {
    // Always re-enable FK enforcement
    db.pragma("foreign_keys = ON");
  }

  console.log("[migration] Migration complete — appointment_services populated, service_id removed.");
}

function seedDemoData() {
  const customerCount = (db.prepare("SELECT COUNT(*) as c FROM customers").get() as { c: number }).c;
  if (customerCount > 0) return;

  // Seed customers
  const insertCustomer = db.prepare(
    "INSERT INTO customers (name, phone, whatsapp, email, total_spent, total_services) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const c1 = insertCustomer.run("Carlos Mendonça", "(11) 98765-4321", "(11) 98765-4321", "carlos@email.com", 1250.0, 5);
  const c2 = insertCustomer.run("Maria Aparecida Silva", "(11) 91234-5678", "(11) 91234-5678", "maria@email.com", 890.0, 3);
  const c3 = insertCustomer.run("Roberto Ferreira", "(11) 99876-5432", "(11) 99876-5432", "roberto@email.com", 2100.0, 8);

  // Seed vehicles
  const insertVehicle = db.prepare(
    "INSERT INTO vehicles (customer_id, brand, model, year, plate, color, fuel) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const v1 = insertVehicle.run(c1.lastInsertRowid, "Toyota", "Corolla", 2021, "ABC-1234", "Prata", "flex");
  const v2 = insertVehicle.run(c2.lastInsertRowid, "Honda", "Civic", 2020, "DEF-5678", "Preto", "gasolina");
  const v3 = insertVehicle.run(c3.lastInsertRowid, "Volkswagen", "Amarok", 2022, "GHI-9012", "Branco", "diesel");

  // Seed services
  const insertService = db.prepare(
    "INSERT INTO services (name, description, price, estimated_duration, category, vehicle_type) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const s1 = insertService.run("Lavagem Completa", "Lavagem externa e interna completa", 80.0, 60, "Lavagem", "todos");
  const s2 = insertService.run("Polimento Simples", "Polimento com máquina de 1 passo", 250.0, 180, "Polimento", "todos");
  const s3 = insertService.run("Higienização Interna", "Limpeza e higienização do interior", 350.0, 240, "Higienização", "todos");
  const s4 = insertService.run("Vitrificação", "Vitrificação de pintura com garantia de 1 ano", 800.0, 480, "Proteção", "todos");
  const s5 = insertService.run("Cristalização de Vidros", "Tratamento de vidros com produto hidrofóbico", 120.0, 90, "Vidros", "todos");

  // Seed products
  const insertProduct = db.prepare(
    "INSERT INTO products (name, brand, supplier, purchase_price, sale_price, stock, minimum_stock, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  insertProduct.run("Shampoo Automotivo", "Meguiar's", "Distribuidora Auto", 35.0, 60.0, 15, 5, "un");
  insertProduct.run("Cera Carnaúba", "Vonixx", "Distribuidora Auto", 45.0, 80.0, 8, 3, "un");
  insertProduct.run("Microfibra Premium", "Autoamerica", "Distribuidora Auto", 12.0, 25.0, 3, 10, "un");
  insertProduct.run("Polidor de Corte", "Meguiar's", "Distribuidora Auto", 55.0, 95.0, 6, 2, "un");

  // Seed appointments (no service_id — use junction table)
  const today = new Date();
  const insertApp = db.prepare(
    "INSERT INTO appointments (customer_id, vehicle_id, appointment_date, status, final_price) VALUES (?, ?, ?, ?, ?)"
  );
  const insertJunction = db.prepare("INSERT OR IGNORE INTO appointment_services (appointment_id, service_id) VALUES (?, ?)");

  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  // a1: Lavagem Completa only
  const a1 = insertApp.run(c1.lastInsertRowid, v1.lastInsertRowid, tomorrow.toISOString(), "agendado", 80.0);
  insertJunction.run(a1.lastInsertRowid, s1.lastInsertRowid);

  // a2: Polimento + Higienização (multi-service)
  const a2 = insertApp.run(c2.lastInsertRowid, v2.lastInsertRowid, today.toISOString(), "em_andamento", 600.0);
  insertJunction.run(a2.lastInsertRowid, s2.lastInsertRowid);
  insertJunction.run(a2.lastInsertRowid, s3.lastInsertRowid);

  // a3: Vitrificação + Cristalização (multi-service)
  const a3 = insertApp.run(c3.lastInsertRowid, v3.lastInsertRowid, yesterday.toISOString(), "concluido", 920.0);
  insertJunction.run(a3.lastInsertRowid, s4.lastInsertRowid);
  insertJunction.run(a3.lastInsertRowid, s5.lastInsertRowid);

  // Seed loyalty cards
  const insertLoyalty = db.prepare(
    "INSERT OR IGNORE INTO loyalty_cards (customer_id, total_washes, current_stamp_count, free_washes_earned, free_washes_used) VALUES (?, ?, ?, ?, ?)"
  );
  insertLoyalty.run(c1.lastInsertRowid, 5, 5, 0, 0);
  insertLoyalty.run(c2.lastInsertRowid, 3, 3, 0, 0);
  insertLoyalty.run(c3.lastInsertRowid, 8, 8, 0, 0);

  // Seed financial transactions
  const insertTx = db.prepare(
    "INSERT INTO financial_transactions (type, category, description, amount, date, appointment_id, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const dateStr = (d: Date) => d.toISOString().split("T")[0];
  insertTx.run("receita", "Serviços", "Vitrificação, Cristalização de Vidros - Roberto Ferreira", 920.0, dateStr(yesterday), a3.lastInsertRowid, "pix");

  // Seed notifications
  db.prepare(
    "INSERT INTO notifications (customer_id, title, message, type) VALUES (?, ?, ?, ?)"
  ).run(c1.lastInsertRowid, "Lembrete de Agendamento", "Carlos Mendonça tem agendamento amanhã.", "reminder_1d");

  // Seed feedback
  db.prepare(
    "INSERT INTO feedback (customer_id, appointment_id, rating, comment) VALUES (?, ?, ?, ?)"
  ).run(c3.lastInsertRowid, a3.lastInsertRowid, 5, "Excelente serviço! Carro ficou como novo.");
}
