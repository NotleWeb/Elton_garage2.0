import { useState } from 'react';
import { 
  useListUsers, useCreateUser, useUpdateUser, getListUsersQueryKey 
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Shield, Plus, Loader2, User as UserIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';

const userSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').optional().or(z.literal('')),
  role: z.enum(['admin', 'technician', 'receptionist']),
  active: z.boolean().default(true)
});

type UserForm = z.infer<typeof userSchema>;

export default function Usuarios() {
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { user: currentUser } = useAuth();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useListUsers({ page, limit: 50 });
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();

  const form = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: '', email: '', password: '', role: 'technician', active: true }
  });

  const onSubmit = (values: UserForm) => {
    // Only send password if it's not empty
    const payload: any = { ...values };
    if (!payload.password) delete payload.password;

    createMutation.mutate({ data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: 'Usuário criado com sucesso!' });
        setIsCreateOpen(false);
        form.reset();
      },
      onError: () => toast({ title: 'Erro ao criar usuário', variant: 'destructive' })
    });
  };

  const handleToggleActive = (id: number, active: boolean) => {
    if (id === currentUser?.id) {
      toast({ title: 'Não é possível desativar o próprio usuário', variant: 'destructive' });
      return;
    }
    updateMutation.mutate({ id, data: { active } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() })
    });
  };

  const getRoleBadge = (role: string) => {
    switch(role) {
      case 'admin': return <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-none">Administrador</Badge>;
      case 'technician': return <Badge className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 border-none">Técnico</Badge>;
      case 'receptionist': return <Badge className="bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 border-none">Recepcionista</Badge>;
      default: return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Controle de Usuários</h1>
          <p className="text-muted-foreground">Gerencie quem tem acesso ao sistema</p>
        </div>
        
        {currentUser?.role === 'admin' && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Novo Usuário</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Cadastrar Novo Usuário</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Nome Completo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>E-mail de Acesso</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="password" render={({ field }) => (
                      <FormItem><FormLabel>Senha</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="role" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Perfil de Acesso</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="receptionist">Recepcionista</SelectItem>
                            <SelectItem value="technician">Técnico</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createMutation.isPending}>Salvar Usuário</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="border-border">
        <div className="rounded-md overflow-hidden">
          <div className="bg-muted/50 grid grid-cols-12 gap-4 p-4 text-sm font-medium text-muted-foreground border-b border-border">
            <div className="col-span-5">Usuário</div>
            <div className="col-span-3 text-center">Perfil</div>
            <div className="col-span-2 text-center">Status</div>
            <div className="col-span-2 text-right">Criado em</div>
          </div>
          
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
            ) : (
              data?.data.map((u) => (
                <div key={u.id} className={`grid grid-cols-12 gap-4 p-4 items-center transition-colors ${!u.active ? 'opacity-60 bg-secondary/10' : 'hover:bg-secondary/30'}`}>
                  <div className="col-span-5 flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {u.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="overflow-hidden">
                      <p className="font-semibold text-foreground truncate flex items-center gap-2">
                        {u.name} {u.id === currentUser?.id && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase">Você</span>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </div>
                  <div className="col-span-3 flex justify-center">
                    {getRoleBadge(u.role)}
                  </div>
                  <div className="col-span-2 flex justify-center items-center gap-2">
                    {currentUser?.role === 'admin' ? (
                      <Switch 
                        checked={u.active} 
                        onCheckedChange={(val) => handleToggleActive(u.id, val)}
                        disabled={u.id === currentUser?.id || updateMutation.isPending}
                      />
                    ) : (
                      <span className={`text-sm ${u.active ? 'text-emerald-500' : 'text-red-500'}`}>{u.active ? 'Ativo' : 'Inativo'}</span>
                    )}
                  </div>
                  <div className="col-span-2 text-right text-sm text-muted-foreground">
                    {formatDateTime(u.createdAt).split(' ')[0]}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}