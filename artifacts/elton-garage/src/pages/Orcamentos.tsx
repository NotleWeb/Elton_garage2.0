import { useMemo, useState } from 'react';
import {
  useListCustomers,
  useListCustomerVehicles,
  useListServices,
} from '@workspace/api-client-react';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown, Download, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '@/hooks/use-toast';

const CATEGORY_ORDER = ['lavagem', 'polimento', 'higienizacao', 'estetica', 'outros'];
const CATEGORY_LABELS: Record<string, string> = {
  lavagem: 'Lavagem',
  polimento: 'Polimento',
  higienizacao: 'Higienização',
  estetica: 'Estética',
  outros: 'Outros',
};

function normalizeCategory(category?: string): string {
  if (!category) return 'outros';
  const normalized = category
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized.includes('lavagem')) return 'lavagem';
  if (normalized.includes('polimento')) return 'polimento';
  if (normalized.includes('higienizacao')) return 'higienizacao';
  if (normalized.includes('estetica')) return 'estetica';
  return 'outros';
}

function displayPlate(plate?: string | null) {
  if (!plate) return 'Sem placa';
  if (/^enc:v1:/i.test(plate)) return 'Sem placa';
  return plate;
}

function cleanVehicleText(value?: string | null) {
  if (!value) return '';
  if (/^enc:v1:/i.test(value)) return '';
  return value;
}

function cleanSensitiveText(value?: string | null) {
  if (!value) return '';
  if (/^enc:v1:/i.test(value)) return '';
  return value;
}

function durationLabel(minutes?: number) {
  const m = Number(minutes ?? 0);
  if (!m) return '0 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}min` : `${h}h`;
}

async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export default function Orcamentos() {
  const { toast } = useToast();
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [serviceIds, setServiceIds] = useState<number[]>([]);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);

  const [garageName, setGarageName] = useState('Elton Garage');
  const [garageAddress, setGarageAddress] = useState('Rua da Garagem, 123 - Centro - Sua Cidade/UF');
  const [garagePhone, setGaragePhone] = useState('(00) 00000-0000');
  const [preferredDateTime, setPreferredDateTime] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState('');

  const { data: customersResponse } = useListCustomers({ limit: 200 });
  const customers = customersResponse?.data || [];
  const { data: vehiclesResponse } = useListCustomerVehicles(customerId || 0, { query: { enabled: !!customerId } as any });
  const vehicles = vehiclesResponse || [];
  const { data: servicesResponse } = useListServices({ limit: 200, active: true });
  const services = servicesResponse?.data || [];
  const servicesByCategory = services.reduce((acc, service) => {
    const key = normalizeCategory(service.category);
    if (!acc[key]) acc[key] = [];
    acc[key].push(service);
    return acc;
  }, {} as Record<string, typeof services>);
  const orderedCategoryKeys = Object.keys(servicesByCategory).sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const selectedCustomer = customers.find((c) => c.id === customerId) || null;
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) || null;
  const selectedServices = services.filter((s) => serviceIds.includes(s.id));

  const subtotal = useMemo(
    () => selectedServices.reduce((sum, s) => sum + Number(s.price || 0), 0),
    [selectedServices]
  );

  const totalMinutes = useMemo(
    () => selectedServices.reduce((sum, s) => sum + Number(s.estimatedDuration || 0), 0),
    [selectedServices]
  );

  const total = Math.max(0, subtotal - Number(discount || 0));

  const toggleService = (id: number) => {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const resetVehicleWhenCustomerChanges = (newCustomerId: number) => {
    setCustomerId(newCustomerId);
    setVehicleId(null);
  };

  const generatePdf = async () => {
    if (!selectedCustomer) {
      toast({ title: 'Selecione o cliente para gerar o orçamento', variant: 'destructive' });
      return;
    }

    if (!selectedVehicle) {
      toast({ title: 'Selecione o veículo para gerar o orçamento', variant: 'destructive' });
      return;
    }

    if (selectedServices.length === 0) {
      toast({ title: 'Selecione pelo menos 1 serviço', variant: 'destructive' });
      return;
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const logoDataUrl = await imageUrlToDataUrl('/logo-elton-garage.jpeg');

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'JPEG', 14, 10, 20, 20);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(garageName, 40, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(garageAddress, 40, 24);
    doc.text(`Contato: ${garagePhone}`, 40, 29);

    doc.setDrawColor(60, 60, 60);
    doc.line(14, 34, 196, 34);

    const budgetCode = `ORC-${Date.now().toString().slice(-6)}`;
    const issueDate = new Date();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('ORCAMENTO DE SERVICOS', 14, 44);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Codigo: ${budgetCode}`, 14, 50);
    doc.text(`Data: ${issueDate.toLocaleDateString('pt-BR')}`, 68, 50);
    doc.text(`Hora: ${issueDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, 110, 50);

    doc.setFont('helvetica', 'bold');
    doc.text('Cliente', 14, 59);
    doc.setFont('helvetica', 'normal');
    doc.text(cleanSensitiveText(selectedCustomer.name) || 'Cliente', 14, 64);
    const safePhone = cleanSensitiveText(selectedCustomer.phone as string | null);
    const safeEmail = cleanSensitiveText(selectedCustomer.email as string | null);
    if (safePhone) doc.text(`Telefone: ${safePhone}`, 14, 69);
    if (safeEmail) doc.text(`E-mail: ${safeEmail}`, 14, 74);

    doc.setFont('helvetica', 'bold');
    doc.text('Veiculo', 110, 59);
    doc.setFont('helvetica', 'normal');
    doc.text(`${cleanVehicleText(selectedVehicle.brand)} ${cleanVehicleText(selectedVehicle.model)}`.trim(), 110, 64);
    doc.text(`Placa: ${displayPlate(selectedVehicle.plate)}`, 110, 69);
    doc.text(`Ano: ${cleanSensitiveText(String(selectedVehicle.year || '')) || '-'}   Cor: ${cleanSensitiveText(selectedVehicle.color as string | null) || '-'}`, 110, 74);

    if (preferredDateTime) {
      doc.setFont('helvetica', 'bold');
      doc.text('Previsao de agendamento:', 14, 82);
      doc.setFont('helvetica', 'normal');
      const d = new Date(preferredDateTime);
      doc.text(d.toLocaleString('pt-BR'), 60, 82);
    }

    autoTable(doc, {
      startY: preferredDateTime ? 88 : 84,
      head: [['Servico', 'Descricao', 'Tempo', 'Valor']],
      body: selectedServices.map((service) => [
        service.name,
        service.description || '-',
        durationLabel(service.estimatedDuration),
        formatCurrency(service.price),
      ]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [22, 22, 22] },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 86 },
        2: { cellWidth: 22 },
        3: { cellWidth: 30, halign: 'right' },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 170;

    doc.setFont('helvetica', 'normal');
    doc.text(`Tempo total estimado: ${durationLabel(totalMinutes)}`, 14, finalY + 10);
    doc.text(`Subtotal: ${formatCurrency(subtotal)}`, 140, finalY + 10, { align: 'right' });
    doc.text(`Desconto: ${formatCurrency(Number(discount || 0))}`, 140, finalY + 16, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`TOTAL: ${formatCurrency(total)}`, 196, finalY + 16, { align: 'right' });

    if (notes.trim()) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Observacoes:', 14, finalY + 28);
      doc.setFont('helvetica', 'normal');
      const wrapped = doc.splitTextToSize(notes.trim(), 180);
      doc.text(wrapped, 14, finalY + 33);
    }

    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('Este documento e apenas um orcamento e nao representa ordem de servico executada.', 14, 287);

    const safeCustomer = selectedCustomer.name.replace(/\s+/g, '-').toLowerCase();
    doc.save(`orcamento-${safeCustomer}-${issueDate.toISOString().slice(0, 10)}.pdf`);

    toast({ title: 'PDF do orçamento gerado com sucesso!' });
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Orçamentos</h1>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <Card className="xl:col-span-2 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Dados do orçamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      {selectedCustomer?.name || 'Selecione o cliente'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter>
                      <CommandInput placeholder="Buscar cliente por nome..." />
                      <CommandList className="max-h-64 overflow-y-auto">
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup heading="Clientes">
                          {customers.map((customer) => {
                            const selected = customer.id === customerId;
                            return (
                              <CommandItem
                                key={customer.id}
                                value={`${customer.name} ${customer.phone || ''} ${customer.whatsapp || ''}`}
                                onSelect={() => {
                                  resetVehicleWhenCustomerChanges(customer.id);
                                  setCustomerPickerOpen(false);
                                }}
                              >
                                <Check className={cn('mr-2 h-4 w-4', selected ? 'opacity-100 text-primary' : 'opacity-0')} />
                                <span className="truncate">{customer.name}</span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Veículo</Label>
                <Select value={vehicleId ? String(vehicleId) : undefined} onValueChange={(v) => setVehicleId(Number(v))}>
                  <SelectTrigger><SelectValue placeholder={customerId ? 'Selecione o veículo' : 'Selecione um cliente primeiro'} /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                        {`${cleanVehicleText(vehicle.brand)} ${cleanVehicleText(vehicle.model)}`.trim()} - {displayPlate(vehicle.plate)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Serviços</Label>
              {serviceIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {serviceIds.map((id) => {
                    const svc = services.find((s) => s.id === id);
                    return svc ? (
                      <Badge key={id} variant="secondary" className="flex items-center gap-1 pl-2.5 pr-1 py-1 text-xs">
                        {svc.name}
                        <button
                          type="button"
                          className="ml-0.5 rounded hover:text-destructive transition-colors"
                          onClick={() => toggleService(id)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}

              <Popover open={servicePickerOpen} onOpenChange={setServicePickerOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between font-normal text-muted-foreground hover:text-foreground">
                    {serviceIds.length === 0
                      ? 'Pesquisar e adicionar serviços...'
                      : `${serviceIds.length} serviço(s) — adicionar mais`}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full max-w-[min(100vw,24rem)] md:max-w-[480px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Pesquisar serviço..." />
                    <CommandList>
                      <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
                      {orderedCategoryKeys.map((categoryKey) => (
                        <CommandGroup key={categoryKey} heading={CATEGORY_LABELS[categoryKey] || 'Outros'}>
                          {servicesByCategory[categoryKey].map((service) => {
                            const selected = serviceIds.includes(service.id);
                            return (
                              <CommandItem key={service.id} value={`${service.name} ${service.category || ''}`} onSelect={() => toggleService(service.id)}>
                                <Check className={cn('mr-2 h-4 w-4', selected ? 'opacity-100 text-primary' : 'opacity-0')} />
                                <span className="flex-1">{service.name}</span>
                                <span className="text-sm font-medium text-primary">{formatCurrency(service.price)}</span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Previsão de data e hora</Label>
                <Input type="datetime-local" value={preferredDateTime} onChange={(e) => setPreferredDateTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Desconto (R$)</Label>
                <Input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da garagem</Label>
                <Input value={garageName} onChange={(e) => setGarageName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Telefone da garagem</Label>
                <Input value={garagePhone} onChange={(e) => setGaragePhone(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Endereço da garagem</Label>
              <Input value={garageAddress} onChange={(e) => setGarageAddress(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informações adicionais para o cliente..." />
            </div>

            <div className="pt-2">
              <Button onClick={generatePdf} className="w-full sm:w-auto">
                <Download className="w-4 h-4 mr-2" /> Gerar PDF do orçamento
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span className="font-medium text-right">{selectedCustomer?.name || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Veículo</span><span className="font-medium text-right">{selectedVehicle ? `${cleanVehicleText(selectedVehicle.brand)} ${cleanVehicleText(selectedVehicle.model)}`.trim() : '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Placa</span><span className="font-medium">{displayPlate(selectedVehicle?.plate) || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Serviços</span><span className="font-medium">{selectedServices.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tempo estimado</span><span className="font-medium">{durationLabel(totalMinutes)}</span></div>
            <div className="border-t border-border pt-3 mt-3 space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Desconto</span><span>{formatCurrency(Number(discount || 0))}</span></div>
              <div className="flex justify-between text-base font-bold text-primary"><span>Total</span><span>{formatCurrency(total)}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
