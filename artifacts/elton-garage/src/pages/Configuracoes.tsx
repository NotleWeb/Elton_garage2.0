import { useState } from 'react';
import { useExportBackup, useRestoreBackup } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Database, Download, Upload, ShieldAlert, Loader2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Configuracoes() {
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();
  
  const { refetch: exportBackup, isFetching: isExporting } = useExportBackup({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { enabled: false } as any,
    request: { responseType: 'blob' as any },
  });

  const restoreMutation = useRestoreBackup();

  const handleExport = async () => {
    try {
      const result = await exportBackup();
      if (result.data) {
        // Create download link for the blob
        const url = window.URL.createObjectURL(result.data as any);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `elton-garage-backup-${new Date().toISOString().split('T')[0]}.db`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast({ title: 'Backup exportado com sucesso!' });
      }
    } catch (error) {
      toast({ title: 'Erro ao exportar backup', variant: 'destructive' });
    }
  };

  const handleRestore = () => {
    if (!file) return;

    if (!confirm('ATENÇÃO: Restaurar o backup irá sobrescrever TODOS os dados atuais do sistema. Esta ação não pode ser desfeita. Deseja continuar?')) {
      return;
    }

    // Since Orval with FormData can be tricky depending on how it was generated,
    // we construct it properly here. The schema expects a `file` field.
    const formData = new FormData();
    formData.append('file', file);

    restoreMutation.mutate({ data: formData as any }, {
      onSuccess: () => {
        toast({ title: 'Backup restaurado com sucesso!', description: 'O sistema será recarregado em instantes.' });
        setTimeout(() => window.location.reload(), 2000);
      },
      onError: () => {
        toast({ title: 'Erro ao restaurar backup', variant: 'destructive' });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações do Sistema</h1>
        <p className="text-muted-foreground">Gerenciamento de dados e segurança</p>
      </div>

      <div className="grid gap-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" /> Backup e Restauração
            </CardTitle>
            <CardDescription>
              Salve uma cópia de segurança de todos os dados (clientes, veículos, O.S., financeiro)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            
            <div className="bg-secondary/30 p-6 rounded-lg border border-border flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h3 className="font-semibold text-foreground">Exportar Banco de Dados</h3>
                <p className="text-sm text-muted-foreground mt-1">Gera um arquivo .db com todo o conteúdo atual</p>
              </div>
              <Button onClick={handleExport} disabled={isExporting} className="shrink-0">
                {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Fazer Download
              </Button>
            </div>

            <div className="border-t border-border pt-8">
              <div className="flex items-start gap-3 mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500">
                <ShieldAlert className="w-6 h-6 shrink-0" />
                <div className="text-sm">
                  <p className="font-bold">Zona de Perigo</p>
                  <p className="mt-1">A restauração de um backup apaga irreversivelmente os dados existentes. Faça um export primeiro para garantir segurança.</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 w-full space-y-2">
                  <label className="text-sm font-medium">Arquivo de Restauração (.db)</label>
                  <Input 
                    type="file" 
                    accept=".db" 
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="cursor-pointer file:bg-primary file:text-primary-foreground file:border-0 file:rounded-md file:mr-4 file:px-4 file:py-1 hover:file:bg-primary/90 transition-all"
                  />
                </div>
                <Button 
                  variant="destructive" 
                  onClick={handleRestore} 
                  disabled={!file || restoreMutation.isPending}
                  className="shrink-0"
                >
                  {restoreMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Restaurar Dados
                </Button>
              </div>
            </div>

          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" /> Sobre o Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="font-medium text-foreground">Versão:</span>
              <span>1.0.0 (Build 2024-10)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="font-medium text-foreground">Ambiente:</span>
              <span>Produção</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="font-medium text-foreground">Licença:</span>
              <span>Elton Garage Detail</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}