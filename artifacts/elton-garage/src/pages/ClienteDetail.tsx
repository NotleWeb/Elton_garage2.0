import { useState } from 'react';
import { useLocation } from 'wouter';
import { 
  useGetCustomer, 
  useUpdateCustomer, 
  getGetCustomerQueryKey,
  useListCustomerAppointments,
  useCreateVehicle,
  getListCustomerVehiclesQueryKey,
  useRedeemFreeWash,
  getGetCustomerLoyaltyQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, Car, Award, Calendar, Edit, Phone, Mail, MapPin, AlignLeft, Gift, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

const vehicleSchema = z.object({
  brand: z.string().min(1, 'Marca obrigatória'),
  model: z.string().min(1, 'Modelo obrigatório'),
  year: z.coerce.number().optional(),
  plate: z.string().optional(),
  color: z.string().optional(),
  fuel: z.enum(['gasolina', 'etanol', 'flex', 'diesel', 'gnv', 'eletrico', 'hibrido']).optional(),
  mileage: z.coerce.number().optional(),
  notes: z.string().optional()
});

type VehicleForm = z.infer<typeof vehicleSchema>;

export default function ClienteDetail({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isVehicleOpen, setIsVehicleOpen] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: customer, isLoading } = useGetCustomer(id, { query: { enabled: !!id } as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: appointmentsResponse } = useListCustomerAppointments(id, { query: { enabled: !!id } as any });
  
  const createVehicleMutation = useCreateVehicle();
  const redeemWashMutation = useRedeemFreeWash();

  const vehicleForm = useForm<VehicleForm>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      brand: '', model: '', plate: '', color: '', fuel: undefined, notes: ''
    }
  });

  const onVehicleSubmit = (values: VehicleForm) => {
    createVehicleMutation.mutate({ data: { ...values, customerId: id } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListCustomerVehiclesQueryKey(id) });
        toast({ title: 'Veículo cadastrado com sucesso!' });
        setIsVehicleOpen(false);
        vehicleForm.reset();
      },
      onError: () => {
        toast({ title: 'Erro ao cadastrar veículo', variant: 'destructive' });
      }
    });
  };

  const handleRedeemWash = () => {
    redeemWashMutation.mutate({ customerId: id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetCustomerLoyaltyQueryKey(id) });
        toast({ title: 'Lavagem gratuita resgatada com sucesso!' });
      },
      onError: () => {
        toast({ title: 'Erro ao resgatar lavagem', variant: 'destructive' });
      }
    });
  };

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!customer) return <div className="p-8 text-center text-muted-foreground">Cliente não encontrado.</div>;

  const loyalty = customer.loyaltyCard;
  const stamps = loyalty?.currentStampCount || 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation('/clientes')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Perfil do Cliente</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info Column */}
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2 border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary text-xl">
                      {customer.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-xl">{customer.name}</CardTitle>
                    <CardDescription>Cliente desde {formatDate(customer.createdAt)}</CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="icon"><Edit className="w-4 h-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-3">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Phone className="w-4 h-4 text-primary/70" />
                  <span className="text-foreground">{customer.whatsapp || customer.phone || 'Não informado'}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Mail className="w-4 h-4 text-primary/70" />
                  <span className="text-foreground">{customer.email || 'Não informado'}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <MapPin className="w-4 h-4 text-primary/70" />
                  <span className="text-foreground">{customer.address || 'Não informado'}</span>
                </div>
                {customer.notes && (
                  <div className="flex items-start gap-3 text-muted-foreground pt-2 border-t border-border">
                    <AlignLeft className="w-4 h-4 text-primary/70 mt-0.5" />
                    <span className="text-foreground">{customer.notes}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-gradient-to-br from-card to-card relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl"></div>
            <CardHeader className="pb-2 relative z-10">
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                Programa de Fidelidade
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <span className="text-3xl font-bold text-foreground">{stamps}</span>
                    <span className="text-muted-foreground">/10 selos</span>
                  </div>
                  {loyalty?.freeWashesPending ? (
                    <Badge className="bg-amber-500 hover:bg-amber-600 text-black border-none">
                      {loyalty.freeWashesPending} lavagem grátis!
                    </Badge>
                  ) : null}
                </div>
                
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div 
                      key={i} 
                      className={`aspect-square rounded-md flex items-center justify-center border-2 transition-all ${
                        i < stamps 
                          ? 'border-primary bg-primary/10 text-primary shadow-[0_0_10px_rgba(var(--primary),0.2)]' 
                          : 'border-border bg-secondary text-muted-foreground/30'
                      }`}
                    >
                      {i === 9 ? <Gift className={`w-5 h-5 ${i < stamps ? 'animate-pulse text-amber-500' : ''}`} /> : <Car className="w-5 h-5" />}
                    </div>
                  ))}
                </div>

                {loyalty?.freeWashesPending ? (
                  <Button 
                    className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold mt-4" 
                    onClick={handleRedeemWash}
                    disabled={redeemWashMutation.isPending}
                  >
                    {redeemWashMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Resgatar Lavagem Grátis
                  </Button>
                ) : (
                  <p className="text-xs text-center text-muted-foreground mt-4">
                    Faltam {10 - stamps} selos para uma lavagem grátis
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Resumo Financeiro</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Gasto</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(customer.totalSpent || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Serviços</p>
                  <p className="text-2xl font-bold">{customer.totalServices || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Column */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Car className="w-5 h-5 text-primary" /> Veículos
              </CardTitle>
              <Dialog open={isVehicleOpen} onOpenChange={setIsVehicleOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" /> Adicionar</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Adicionar Veículo</DialogTitle></DialogHeader>
                  <Form {...vehicleForm}>
                    <form onSubmit={vehicleForm.handleSubmit(onVehicleSubmit)} className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={vehicleForm.control} name="brand" render={({ field }) => (
                          <FormItem><FormLabel>Marca</FormLabel><FormControl><Input placeholder="Ex: VW" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={vehicleForm.control} name="model" render={({ field }) => (
                          <FormItem><FormLabel>Modelo</FormLabel><FormControl><Input placeholder="Ex: Polo" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <FormField control={vehicleForm.control} name="year" render={({ field }) => (
                          <FormItem><FormLabel>Ano</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={vehicleForm.control} name="plate" render={({ field }) => (
                          <FormItem><FormLabel>Placa</FormLabel><FormControl><Input placeholder="ABC-1234" {...field} className="uppercase" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={vehicleForm.control} name="color" render={({ field }) => (
                          <FormItem><FormLabel>Cor</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <FormField control={vehicleForm.control} name="fuel" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Combustível</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="gasolina">Gasolina</SelectItem>
                              <SelectItem value="etanol">Etanol</SelectItem>
                              <SelectItem value="flex">Flex</SelectItem>
                              <SelectItem value="diesel">Diesel</SelectItem>
                              <SelectItem value="gnv">GNV</SelectItem>
                              <SelectItem value="eletrico">Elétrico</SelectItem>
                              <SelectItem value="hibrido">Híbrido</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={vehicleForm.control} name="notes" render={({ field }) => (
                        <FormItem><FormLabel>Observações</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsVehicleOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={createVehicleMutation.isPending}>Salvar Veículo</Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {customer.vehicles && customer.vehicles.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {customer.vehicles.map((v) => (
                    <div key={v.id} className="p-4 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors flex gap-4">
                      <div className="bg-background p-3 rounded-full shrink-0 border border-border h-fit">
                        <Car className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-foreground truncate">{v.brand} {v.model}</h4>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                          {v.plate && <span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">{v.plate.toUpperCase()}</span>}
                          {v.year && <span>{v.year}</span>}
                          {v.color && <span>{v.color}</span>}
                          {v.fuel && <span className="capitalize">{v.fuel}</span>}
                        </div>
                        {v.notes && <p className="text-xs text-muted-foreground mt-2 border-t border-border/50 pt-2 truncate">{v.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-lg bg-secondary/10">
                  <Car className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p>Nenhum veículo cadastrado</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" /> Histórico de Agendamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {!appointmentsResponse?.data?.length ? (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-lg bg-secondary/10">
                    <p>Nenhum histórico encontrado</p>
                  </div>
                ) : (
                  <div className="relative border-l border-border ml-4 space-y-6 pb-4">
                    {appointmentsResponse.data.map((apt) => (
                      <div key={apt.id} className="relative pl-6">
                        <div className={`absolute -left-1.5 top-1.5 w-3 h-3 rounded-full border-2 border-background
                          ${apt.status === 'concluido' ? 'bg-emerald-500' : 
                            apt.status === 'cancelado' ? 'bg-red-500' : 
                            'bg-primary'}`} 
                        />
                        <div className="bg-secondary/30 p-4 rounded-lg border border-border">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <h4 className="font-semibold text-foreground">{apt.service?.name || 'Serviço'}</h4>
                            <Badge variant="outline" className={
                              apt.status === 'concluido' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                              apt.status === 'cancelado' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                              'bg-primary/10 text-primary border-primary/20'
                            }>
                              {apt.status === 'concluido' ? 'Concluído' : 
                               apt.status === 'cancelado' ? 'Cancelado' : 
                               apt.status === 'em_andamento' ? 'Em Andamento' :
                               apt.status === 'confirmado' ? 'Confirmado' : 'Agendado'}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-2">
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDateTime(apt.appointmentDate)}</span>
                            {apt.vehicle && <span className="flex items-center gap-1"><Car className="w-3.5 h-3.5" /> {apt.vehicle.brand} {apt.vehicle.model}</span>}
                          </div>
                          {apt.finalPrice && (
                            <div className="mt-3 font-medium text-primary">
                              {formatCurrency(apt.finalPrice)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}