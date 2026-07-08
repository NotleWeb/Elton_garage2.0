import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useListCustomers, useCreateCustomer, getListCustomersQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Plus, User as UserIcon, Loader2, ChevronRight, Phone } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';

const customerSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type CustomerForm = z.infer<typeof customerSchema>;

export default function Clientes() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useListCustomers({ 
    page, 
    limit: 20, 
    search: debouncedSearch || undefined,
    sortBy: 'name',
    sortOrder: 'asc'
  });

  const createMutation = useCreateCustomer();

  const form = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '', phone: '', whatsapp: '', email: '', address: '', notes: ''
    }
  });

  const onSubmit = (values: CustomerForm) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        toast({ title: 'Cliente cadastrado com sucesso!' });
        setIsCreateOpen(false);
        form.reset();
      },
      onError: () => {
        toast({ title: 'Erro ao cadastrar cliente', variant: 'destructive' });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar cliente..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="shrink-0"><Plus className="w-4 h-4 mr-2" /> Novo Cliente</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Nome Completo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="whatsapp" render={({ field }) => (
                      <FormItem><FormLabel>WhatsApp</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>E-mail</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem><FormLabel>Endereço</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem><FormLabel>Observações</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Salvar Cliente
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-border">
        <div className="rounded-md border border-border overflow-hidden">
          <div className="bg-muted/50 grid grid-cols-12 gap-4 p-4 text-sm font-medium text-muted-foreground border-b border-border">
            <div className="col-span-5">Cliente</div>
            <div className="col-span-2 hidden md:block">Contato</div>
            <div className="col-span-2 text-right">Valor Gasto</div>
            <div className="col-span-2 text-right hidden lg:block">Última Visita</div>
            <div className="col-span-1"></div>
          </div>
          
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
            ) : data?.data.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhum cliente encontrado.</div>
            ) : (
              data?.data.map((customer) => (
                <Link key={customer.id} href={`/clientes/${customer.id}`}>
                  <div className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-secondary/50 transition-colors cursor-pointer group">
                    <div className="col-span-11 md:col-span-5 flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-border">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {customer.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="overflow-hidden">
                        <p className="font-medium truncate text-foreground group-hover:text-primary transition-colors">
                          {customer.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{customer.totalServices} serviços realizados</p>
                      </div>
                    </div>
                    <div className="col-span-2 hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                      {(customer.whatsapp || customer.phone) ? (
                        <>
                          <Phone className="w-3 h-3" />
                          <span className="truncate">{customer.whatsapp || customer.phone}</span>
                        </>
                      ) : '-'}
                    </div>
                    <div className="col-span-2 text-right font-medium">
                      {formatCurrency(customer.totalSpent || 0)}
                    </div>
                    <div className="col-span-2 text-right hidden lg:block text-sm text-muted-foreground">
                      {customer.lastServiceDate ? formatDate(customer.lastServiceDate) : '-'}
                    </div>
                    <div className="col-span-1 text-right flex justify-end">
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </Card>
      
      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button 
            variant="outline" 
            disabled={page === 1} 
            onClick={() => setPage(p => p - 1)}
          >
            Anterior
          </Button>
          <div className="flex items-center px-4 text-sm font-medium">
            Página {page} de {data.meta.totalPages}
          </div>
          <Button 
            variant="outline" 
            disabled={page >= data.meta.totalPages} 
            onClick={() => setPage(p => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}