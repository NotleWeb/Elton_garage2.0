import { useState } from 'react';
import { 
  useListTransactions, useCreateTransaction, getListTransactionsQueryKey,
  useGetFinancialSummary, useUpdateTransaction, useDeleteTransaction
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, ArrowDownRight, ArrowUpRight, Loader2, TrendingUp, TrendingDown, DollarSign, Edit2, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const transactionSchema = z.object({
  type: z.enum(['receita', 'despesa']),
  category: z.string().optional(),
  description: z.string().min(2, 'Descrição obrigatória'),
  amount: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
  date: z.string().min(1, 'Data obrigatória'),
  paymentMethod: z.enum(['dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'transferencia']).optional()
});

type TransactionForm = z.infer<typeof transactionSchema>;

export default function Financeiro() {
  const currentDate = new Date();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>('todos');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: summary, isLoading: summaryLoading } = useGetFinancialSummary({ month, year });
  
  const { data: transactions, isLoading: txLoading } = useListTransactions({ 
    page, 
    limit: 20,
    type: typeFilter !== 'todos' ? (typeFilter as any) : undefined
  });

  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();

  const form = useForm<TransactionForm>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'despesa', category: 'Geral', description: '', amount: 0, date: new Date().toISOString().split('T')[0], paymentMethod: undefined
    }
  });

  const handleEditTransaction = (tx: any) => {
    setEditingId(tx.id);
    form.reset({
      type: tx.type,
      category: tx.category,
      description: tx.description,
      amount: tx.amount,
      date: tx.date.split('T')[0],
      paymentMethod: tx.paymentMethod
    });
    setIsCreateOpen(true);
  };

  const handleDeleteTransaction = (id: number) => {
    setShowDeleteConfirm(id);
  };

  const confirmDelete = () => {
    if (showDeleteConfirm === null) return;
    deleteMutation.mutate({ id: showDeleteConfirm }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
        toast({ title: 'Transação removida com sucesso!' });
        setShowDeleteConfirm(null);
      },
      onError: () => toast({ title: 'Erro ao remover transação', variant: 'destructive' })
    });
  };

  const onSubmit = (values: TransactionForm) => {
    let dateStr = values.date;
    if (dateStr.length === 10) dateStr += 'T12:00:00.000Z';
    else if (!dateStr.endsWith('Z')) dateStr = new Date(dateStr).toISOString();

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: { ...values, date: dateStr } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
          toast({ title: 'Transação atualizada com sucesso!' });
          setIsCreateOpen(false);
          setEditingId(null);
          form.reset();
        },
        onError: () => toast({ title: 'Erro ao atualizar transação', variant: 'destructive' })
      });
    } else {
      createMutation.mutate({ data: { ...values, date: dateStr } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
          toast({ title: 'Transação registrada com sucesso!' });
          setIsCreateOpen(false);
          form.reset();
        },
        onError: () => toast({ title: 'Erro ao registrar transação', variant: 'destructive' })
      });
    }
  };

  const getMethodLabel = (method?: string) => {
    const labels: Record<string, string> = {
      dinheiro: 'Dinheiro', cartao_credito: 'Crédito', cartao_debito: 'Débito', pix: 'PIX', transferencia: 'Transferência'
    };
    return method ? labels[method] : '-';
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Financeiro</h1>
        <Dialog open={isCreateOpen} onOpenChange={(open) => { 
          setIsCreateOpen(open); 
          if (!open) { 
            setEditingId(null); 
            form.reset({ 
              type: 'despesa', category: 'Geral', description: '', amount: 0, 
              date: new Date().toISOString().split('T')[0], paymentMethod: undefined 
            }); 
          }
        }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> {editingId ? 'Editar' : 'Nova'} Transação</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? 'Editar Transação' : 'Registrar Transação'}</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="receita" className="text-emerald-500 font-medium">Receita (+)</SelectItem>
                          <SelectItem value="despesa" className="text-red-500 font-medium">Despesa (-)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="amount" render={({ field }) => (
                    <FormItem><FormLabel>Valor (R$)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Descrição</FormLabel><FormControl><Input placeholder="Conta de luz, compra de material..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="Serviços">Serviços</SelectItem>
                          <SelectItem value="Produtos">Produtos</SelectItem>
                          <SelectItem value="Insumos">Insumos/Material</SelectItem>
                          <SelectItem value="Despesas Fixas">Despesas Fixas</SelectItem>
                          <SelectItem value="Impostos">Impostos</SelectItem>
                          <SelectItem value="Geral">Geral</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Método de Pagamento</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger></FormControl>
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
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem><FormLabel>Data</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => { setIsCreateOpen(false); setEditingId(null); }}>Cancelar</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editingId ? 'Atualizar' : 'Salvar'}</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12 bg-secondary/50 border border-border">
          <TabsTrigger value="resumo" className="data-[state=active]:bg-card">Resumo Mensal</TabsTrigger>
          <TabsTrigger value="transacoes" className="data-[state=active]:bg-card">Lançamentos</TabsTrigger>
        </TabsList>
        
        <TabsContent value="resumo" className="mt-6 space-y-6">
          <div className="flex items-center justify-between mb-4 bg-card p-4 rounded-lg border border-border shadow-sm">
            <h2 className="text-xl font-bold capitalize">{format(new Date(year, month - 1), "MMMM 'de' yyyy", { locale: ptBR })}</h2>
            <div className="flex gap-2">
              <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <SelectItem key={i+1} value={String(i+1)} className="capitalize">
                      {format(new Date(2020, i), 'MMMM', { locale: ptBR })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
                <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[year-1, year, year+1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {summaryLoading ? (
            <div className="h-64 flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Receitas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <ArrowDownRight className="w-5 h-5 text-emerald-500" />
                    <span className="text-3xl font-bold text-emerald-500">{formatCurrency(summary?.totalRevenue || 0)}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Despesas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <ArrowUpRight className="w-5 h-5 text-red-500" />
                    <span className="text-3xl font-bold text-red-500">{formatCurrency(summary?.totalExpenses || 0)}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border border-l-4 border-l-primary bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Resultado (Lucro)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-primary" />
                    <span className="text-3xl font-bold text-primary">{formatCurrency(summary?.profit || 0)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="transacoes" className="mt-6">
          <div className="mb-4">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos lançamentos</SelectItem>
                <SelectItem value="receita">Apenas Receitas</SelectItem>
                <SelectItem value="despesa">Apenas Despesas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="border-border">
            <div className="rounded-md overflow-hidden">
              <div className="bg-muted/50 grid grid-cols-12 gap-4 p-4 text-sm font-medium text-muted-foreground border-b border-border">
                <div className="col-span-2">Data</div>
                <div className="col-span-4">Descrição</div>
                <div className="col-span-2 hidden md:block text-center">Categoria</div>
                <div className="col-span-1 hidden md:block text-center">Pagamento</div>
                <div className="col-span-4 md:col-span-2 text-right">Valor</div>
                <div className="col-span-2 md:col-span-1 text-right">Ações</div>
              </div>
              
              <div className="divide-y divide-border">
                {txLoading ? (
                  <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
                ) : transactions?.data.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">Nenhuma transação encontrada.</div>
                ) : (
                  transactions?.data.map((tx) => (
                    <div key={tx.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-secondary/30 transition-colors">
                      <div className="col-span-2 text-sm text-muted-foreground">
                        {formatDateTime(tx.date).split(' ')[0]}
                      </div>
                      <div className="col-span-4">
                        <p className="font-medium text-foreground truncate">{tx.description}</p>
                        {tx.appointmentId && <p className="text-xs text-primary">OS #{tx.appointmentId}</p>}
                      </div>
                      <div className="col-span-2 hidden md:block text-center text-sm text-muted-foreground">
                        {tx.category || '-'}
                      </div>
                      <div className="col-span-1 hidden md:block text-center text-sm text-muted-foreground">
                        {getMethodLabel(tx.paymentMethod)}
                      </div>
                      <div className={`col-span-2 text-right font-bold ${tx.type === 'receita' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {tx.type === 'receita' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </div>
                      <div className="col-span-2 md:col-span-1 flex justify-end items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          onClick={() => handleEditTransaction(tx)}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteTransaction(tx.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>
          
          {transactions?.meta && transactions.meta.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <div className="flex items-center px-4 text-sm font-medium">Página {page} de {transactions.meta.totalPages}</div>
              <Button variant="outline" disabled={page >= transactions.meta.totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog — rendered at page root to avoid portal/overflow issues */}
      <Dialog open={showDeleteConfirm !== null} onOpenChange={(open) => { if (!open) setShowDeleteConfirm(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar Exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja remover esta transação? Esta ação não pode ser desfeita.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={confirmDelete}>
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}