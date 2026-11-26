import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatDate(date: string | Date, pattern: string = 'dd/MM/yyyy') {
  if (!date) return '';
  return format(new Date(date), pattern, { locale: ptBR })
}

export function formatDateTime(date: string | Date) {
  if (!date) return '';
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: ptBR })
}