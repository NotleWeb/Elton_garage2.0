import { useState } from 'react';
import { 
  useListFeedback, useCreateFeedback, useDeleteFeedback, getListFeedbackQueryKey, useListCustomers
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Star, Plus, Loader2, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const feedbackSchema = z.object({
  customerId: z.coerce.number().min(1, 'Cliente obrigatório'),
  rating: z.coerce.number().min(1).max(5),
  comment: z.string().optional()
});

type FeedbackForm = z.infer<typeof feedbackSchema>;

export default function Avaliacoes() {
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useListFeedback({ page, limit: 20 });
  const { data: customers } = useListCustomers({ limit: 100 });

  const createMutation = useCreateFeedback();
  const deleteMutation = useDeleteFeedback();

  const form = useForm<FeedbackForm>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { customerId: 0, rating: 5, comment: '' }
  });

  const onSubmit = (values: FeedbackForm) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFeedbackQueryKey() });
        toast({ title: 'Avaliação registrada com sucesso!' });
        setIsCreateOpen(false);
        form.reset();
      },
      onError: () => toast({ title: 'Erro ao registrar avaliação', variant: 'destructive' })
    });
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} className={`w-4 h-4 ${i < rating ? 'fill-amber-500 text-amber-500' : 'text-muted'}`} />
    ));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Avaliações de Clientes</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-muted-foreground text-sm">Média Geral:</span>
            <div className="flex items-center">
              <Star className="w-4 h-4 fill-amber-500 text-amber-500 mr-1" />
              <span className="font-bold">{data?.averageRating ? data.averageRating.toFixed(1) : '0.0'}</span>
            </div>
          </div>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Registrar Feedback</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Avaliação de Cliente</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField control={form.control} name="customerId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value ? String(field.value) : undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {customers?.data.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="rating" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nota (1 a 5)</FormLabel>
                    <Select onValueChange={(v) => field.onChange(parseInt(v))} defaultValue={String(field.value)}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {[5, 4, 3, 2, 1].map(r => (
                          <SelectItem key={r} value={String(r)}>
                            <div className="flex items-center gap-1">{renderStars(r)}</div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="comment" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comentário (opcional)</FormLabel>
                    <FormControl><Textarea placeholder="O que o cliente achou do serviço?" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createMutation.isPending}>Salvar</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="col-span-full py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : data?.data.length === 0 ? (
          <div className="col-span-full py-16 text-center text-muted-foreground border-2 border-dashed border-border rounded-lg bg-secondary/10">
            Nenhuma avaliação registrada ainda.
          </div>
        ) : (
          data?.data.map((feedback) => (
            <Card key={feedback.id} className="border-border hover:border-primary/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {feedback.customer?.name?.substring(0, 2).toUpperCase() || 'CL'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-semibold text-foreground">{feedback.customer?.name || 'Cliente Excluído'}</h4>
                      <div className="flex gap-1 mt-0.5">{renderStars(feedback.rating)}</div>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-red-500/50 hover:text-red-500 hover:bg-red-500/10 h-8 w-8"
                    onClick={() => {
                      if (confirm('Deseja excluir esta avaliação?')) {
                        deleteMutation.mutate({ id: feedback.id }, {
                          onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFeedbackQueryKey() })
                        });
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                {feedback.comment ? (
                  <p className="text-sm text-foreground bg-secondary/30 p-3 rounded-lg border border-border/50 italic">
                    "{feedback.comment}"
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Sem comentário adicionado.</p>
                )}
                <div className="mt-4 text-xs text-muted-foreground text-right">
                  {formatDateTime(feedback.createdAt)}
                  {feedback.appointmentId && ` • OS #${feedback.appointmentId}`}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <div className="flex items-center px-4 text-sm font-medium">Página {page} de {data.meta.totalPages}</div>
          <Button variant="outline" disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
        </div>
      )}
    </div>
  );
}