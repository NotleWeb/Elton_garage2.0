import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

function toSafeDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    // Parse date-only values as local date to avoid UTC offset day shifts.
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }
  return new Date(value);
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatDate(date: string | Date, pattern: string = 'dd/MM/yyyy') {
  if (!date) return '';
  return format(toSafeDate(date), pattern, { locale: ptBR })
}

export function formatDateTime(date: string | Date) {
  if (!date) return '';
  return format(toSafeDate(date), 'dd/MM/yyyy HH:mm', { locale: ptBR })
}