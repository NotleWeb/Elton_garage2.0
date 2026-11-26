import { useState } from 'react';
import { useListLoyaltyCards, useRedeemFreeWash, getListLoyaltyCardsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Award, Gift, Loader2, Search, Car } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export default function Fidelidade() {
  const [page, setPage] = useState(1);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useListLoyaltyCards({ 
    page, 
    limit: 30,
    freeWashPending: showPendingOnly ? true : undefined
  });

  const redeemMutation = useRedeemFreeWash();

  const handleRedeem = (customerId: number) => {
    redeemMutation.mutate({ customerId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLoyaltyCardsQueryKey() });
        toast({ title: 'Lavagem grátis resgatada com sucesso!' });
      },
      onError: () => toast({ title: 'Erro ao resgatar', variant: 'destructive' })
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fidelidade</h1>
          <p className="text-muted-foreground">Acompanhe as cartelas de fidelidade dos clientes</p>
        </div>
        
        <div className="flex items-center space-x-2 bg-secondary/50 px-4 py-2 rounded-md border border-border">
          <Switch id="pending-only" checked={showPendingOnly} onCheckedChange={setShowPendingOnly} />
          <label htmlFor="pending-only" className="text-sm font-medium cursor-pointer">
            Apenas cartelas com prêmio pendente
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="col-span-full py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : data?.data.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed border-border rounded-lg bg-secondary/10">
            <Award className="w-8 h-8 mx-auto mb-2 opacity-50" />
            Nenhuma cartela encontrada.
          </div>
        ) : (
          data?.data.map((card) => (
            <Card key={card.id} className={`border-border overflow-hidden ${card.freeWashesPending > 0 ? 'ring-1 ring-amber-500/50' : ''}`}>
              <CardHeader className="pb-4 bg-secondary/20">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-xl">{card.customer?.name || 'Cliente'}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Total acumulado: {card.totalWashes} lavagens</p>
                  </div>
                  {card.freeWashesPending > 0 && (
                    <Badge className="bg-amber-500 text-black border-none px-3 py-1 text-sm shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                      {card.freeWashesPending} Prêmio{card.freeWashesPending > 1 ? 's' : ''}!
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-5 gap-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div 
                      key={i} 
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center border-2 transition-all ${
                        i < card.currentStampCount 
                          ? 'border-primary bg-primary/10 text-primary shadow-[0_0_10px_rgba(var(--primary),0.15)]' 
                          : 'border-border bg-secondary/50 text-muted-foreground/30'
                      }`}
                    >
                      {i === 9 ? (
                        <Gift className={`w-6 h-6 ${i < card.currentStampCount ? 'text-amber-500' : ''}`} />
                      ) : (
                        <Car className="w-6 h-6" />
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">
                    Prêmios já utilizados: <span className="font-bold text-foreground">{card.freeWashesUsed}</span>
                  </div>
                  <Button 
                    variant={card.freeWashesPending > 0 ? 'default' : 'secondary'}
                    className={card.freeWashesPending > 0 ? 'bg-amber-500 hover:bg-amber-600 text-black font-semibold' : ''}
                    disabled={card.freeWashesPending === 0 || redeemMutation.isPending}
                    onClick={() => handleRedeem(card.customerId)}
                  >
                    {card.freeWashesPending > 0 ? 'Resgatar Prêmio' : 'Sem prêmio pendente'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <div className="flex items-center px-4 text-sm font-medium">Página {page} de {data.meta.totalPages}</div>
          <Button variant="outline" disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
        </div>
      )}
    </div>
  );
}