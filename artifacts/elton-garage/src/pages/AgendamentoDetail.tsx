import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  useGetAppointment, useUpdateAppointmentStatus,
  useGetOrderService, useCreateOrderService, useUpdateOrderService,
  useListProductUsage, useCreateProductUsage, useDeleteProductUsage,
  getGetAppointmentQueryKey, getGetOrderServiceQueryKey, getListProductUsageQueryKey,
  useListProducts, getListTransactionsQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency, formatAppointmentDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, CheckCircle2, User, Car, Wrench, Package, Trash2, Plus, Clock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

const osSchema = z.object({
  technician: z.string().optional(),
  paymentMethod: z.enum(['dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'transferencia']).optional(),
  observations: z.string().optional()
});

type OsForm = z.infer<typeof osSchema>;

const STEPS = ['agendado', 'confirmado', 'em_andamento', 'concluido'];
const STATUS_LABELS: Record<string, string> = {
  agendado: 'Agendado', confirmado: 'Confirmado', em_andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado'
};

function formatDuration(minutes: number): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h > 0 ? `${h}h` : '', m > 0 ? `${m}min` : ''].filter(Boolean).join(' ');
}

export default function AgendamentoDetail({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [productToAdd, setProductToAdd] = useState<string>('');
  const [quantityToAdd, setQuantityToAdd] = useState<number>(1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: appointment, isLoading: aptLoading } = useGetAppointment(id, { query: { enabled: !!id } as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: os } = useGetOrderService(id, { query: { enabled: !!id, retry: false } as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: usages } = useListProductUsage(id, { query: { enabled: !!id } as any });
  const { data: productsData } = useListProducts({ limit: 100 });

  const productUsages = usages as any[] | undefined;
  const statusMutation = useUpdateAppointmentStatus();
  const createOsMutation = useCreateOrderService();
  const updateOsMutation = useUpdateOrderService();
  const addProductMutation = useCreateProductUsage();
  const delProductMutation = useDeleteProductUsage();

  const form = useForm<OsForm>({
    resolver: zodResolver(osSchema),
    defaultValues: { technician: '', paymentMethod: undefined, observations: '' }
  });

  useEffect(() => {
    if (os) {
      form.reset({
        technician: os.technician || '',
        paymentMethod: os.paymentMethod || undefined,
        observations: os.observations || ''
      });
    }
  }, [os, form]);

  const onOsSubmit = (values: OsForm) => {
    const payload = { id, data: values };
    const mutation = os ? updateOsMutation : createOsMutation;
    mutation.mutate(payload as any, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOrderServiceQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
        toast({ title: 'Ordem de serviço salva com sucesso!' });
      },
      onError: () => toast({ title: 'Erro ao salvar O.S.', variant: 'destructive' })
    });
  };

  const handleStatusChange = (status: string) => {
    statusMutation.mutate({ id, data: { status: status as any } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAppointmentQueryKey(id) });
        toast({ title: `Status atualizado para ${STATUS_LABELS[status]}` });
      }
    });
  };

  const handleAddProduct = () => {
    if (!productToAdd || quantityToAdd <= 0) return;
    addProductMutation.mutate({ id, data: { productId: parseInt(productToAdd), quantity: quantityToAdd } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductUsageQueryKey(id) });
        toast({ title: 'Produto adicionado' });
        setProductToAdd('');
        setQuantityToAdd(1);
      }
    });
  };

  if (aptLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!appointment) return <div className="p-8 text-center text-muted-foreground">Agendamento não encontrado.</div>;

  const currentStepIdx = STEPS.indexOf(appointment.status);
  // Services come from the multi-service API
  const aptServices: any[] = (appointment as any).services || [];
  const subtotal = aptServices.reduce((s: number, sv: any) => s + (sv.price || 0), 0);
  const discount = appointment.discount ?? 0;
  const totalDuration = (appointment as any).totalDuration || aptServices.reduce((s: number, sv: any) => s + (sv.estimatedDuration || 0), 0);

  return (
    <div className="page-shell pb-12">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation('/agendamentos')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="page-title">O.S. #{appointment.id}</h1>
          <p className="text-muted-foreground">{formatAppointmentDateTime(appointment.appointmentDate)}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {appointment.status === 'cancelado' ? (
            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-sm px-3 py-1">Cancelado</Badge>
          ) : (
            <Button
              variant="outline"
              className="text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/20"
              onClick={() => handleStatusChange('cancelado')}
            >
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {appointment.status !== 'cancelado' && (
        <Card className="border-border">
          <CardContent className="p-6">
            <div className="flex justify-between items-center relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-secondary -z-10 rounded"></div>
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary -z-10 rounded transition-all duration-500"
                style={{ width: `${(Math.max(0, currentStepIdx) / (STEPS.length - 1)) * 100}%` }}></div>

              {STEPS.map((step, idx) => {
                const isCompleted = currentStepIdx >= idx;
                const isCurrent = currentStepIdx === idx;
                return (
                  <button
                    key={step}
                    onClick={() => handleStatusChange(step)}
                    className="flex flex-col items-center gap-2 focus:outline-none group"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300
                      ${isCompleted ? 'bg-primary border-primary text-primary-foreground' : 'bg-card border-border text-muted-foreground group-hover:border-primary/50'}`}>
                      {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <span>{idx + 1}</span>}
                    </div>
                    <span className={`text-xs font-medium ${isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {STATUS_LABELS[step]}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Cliente */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2"><User className="w-5 h-5 text-primary" /> Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-foreground text-lg">{appointment.customer?.name}</p>
            <p className="text-sm text-muted-foreground">{(appointment.customer as any)?.whatsapp || appointment.customer?.phone || 'Sem telefone'}</p>
            <p className="text-sm text-muted-foreground mt-1">{appointment.customer?.email}</p>
          </CardContent>
        </Card>

        {/* Veículo */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2"><Car className="w-5 h-5 text-primary" /> Veículo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-foreground text-lg">{appointment.vehicle?.brand} {appointment.vehicle?.model}</p>
            <p className="text-sm font-mono text-muted-foreground uppercase">{appointment.vehicle?.plate || 'S/ PLACA'}</p>
            <p className="text-sm text-muted-foreground mt-1 capitalize">{appointment.vehicle?.color} • {appointment.vehicle?.year}</p>
          </CardContent>
        </Card>

        {/* Serviços */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" /> Serviços
              {aptServices.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs">{aptServices.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aptServices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum serviço vinculado.</p>
            ) : (
              <div className="space-y-1.5">
                {aptServices.map((svc: any) => (
                  <div key={svc.id} className="flex justify-between items-center text-sm">
                    <div className="flex flex-col min-w-0 flex-1 mr-2">
                      <span className="font-medium text-foreground truncate">{svc.name}</span>
                      {svc.estimatedDuration > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />{formatDuration(svc.estimatedDuration)}
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground shrink-0">{formatCurrency(svc.price)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Totals */}
            {aptServices.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border space-y-1">
                {aptServices.length > 1 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-500">
                    <span>Desconto:</span>
                    <span>-{formatCurrency(discount)}</span>
                  </div>
                )}
                {totalDuration > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Tempo total:</span>
                    <span>{formatDuration(totalDuration)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-border">
                  <span className="font-semibold text-foreground">Total:</span>
                  <span className="font-bold text-primary text-lg">{formatCurrency(appointment.finalPrice || 0)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="os" className="w-full">
        <TabsList className="w-full justify-start bg-secondary/50 border border-border h-12">
          <TabsTrigger value="os" className="data-[state=active]:bg-card data-[state=active]:text-primary">Ordem de Serviço</TabsTrigger>
          <TabsTrigger value="produtos" className="data-[state=active]:bg-card data-[state=active]:text-primary">Produtos Utilizados</TabsTrigger>
        </TabsList>

        <TabsContent value="os" className="mt-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Detalhes da Execução</CardTitle>
              <CardDescription>Informações preenchidas durante ou após o serviço</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onOsSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="technician" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Técnico Responsável</FormLabel>
                        <FormControl><Input placeholder="Nome do técnico" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Método de Pagamento</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="dinheiro">Dinheiro</SelectItem>
                            <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                            <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                            <SelectItem value="pix">PIX</SelectItem>
                            <SelectItem value="transferencia">Transferência</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="observations" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações / Checklist</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Avarias pré-existentes, recomendações para o cliente..." className="min-h-[120px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={createOsMutation.isPending || updateOsMutation.isPending}>
                      {(createOsMutation.isPending || updateOsMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Salvar O.S.
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="produtos" className="mt-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Consumo de Estoque</CardTitle>
              <CardDescription>Registre os produtos utilizados para baixar automaticamente do estoque</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-secondary/30 rounded-lg border border-border">
                <div className="flex-1">
                  <Select value={productToAdd} onValueChange={setProductToAdd}>
                    <SelectTrigger><SelectValue placeholder="Selecione um produto do estoque" /></SelectTrigger>
                    <SelectContent>
                      {productsData?.data.map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name} (Disponível: {p.stock} {p.unit})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32">
                  <Input type="number" step="0.01" min="0.01" value={quantityToAdd} onChange={(e) => setQuantityToAdd(Number(e.target.value))} placeholder="Qtd" />
                </div>
                <Button onClick={handleAddProduct} disabled={!productToAdd || addProductMutation.isPending} className="shrink-0">
                  {addProductMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Adicionar
                </Button>
              </div>

              <div className="rounded-md border border-border overflow-hidden">
                <div className="bg-muted/50 grid grid-cols-12 gap-4 p-3 text-sm font-medium text-muted-foreground border-b border-border">
                  <div className="col-span-6">Produto</div>
                  <div className="col-span-4 text-right">Quantidade Utilizada</div>
                  <div className="col-span-2 text-center">Ação</div>
                </div>
                <div className="divide-y divide-border">
                  {!productUsages?.length ? (
                    <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                      <Package className="w-8 h-8 mb-2 opacity-50" />
                      Nenhum produto registrado nesta O.S.
                    </div>
                  ) : (
                    productUsages.map((u) => (
                      <div key={u.id} className="grid grid-cols-12 gap-4 p-3 items-center">
                        <div className="col-span-6 font-medium">{u.product?.name}</div>
                        <div className="col-span-4 text-right">{u.quantity} {u.product?.unit}</div>
                        <div className="col-span-2 flex justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 w-8"
                            onClick={() => {
                              delProductMutation.mutate({ id: u.id }, {
                                onSuccess: () => queryClient.invalidateQueries({ queryKey: getListProductUsageQueryKey(id) })
                              });
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
