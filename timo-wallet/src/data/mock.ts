export type TxType = 'pix_in' | 'pix_out' | 'ted' | 'card' | 'salary' | 'boleto' | 'cashback' | 'fee'

export interface Transaction {
  id: string
  type: TxType
  title: string
  subtitle: string
  amount: number
  date: string
  time: string
  status: 'completed' | 'pending' | 'failed'
  category: string
}

export interface PixKey {
  id: string
  type: 'cpf' | 'email' | 'phone' | 'random'
  value: string
  label: string
  primary: boolean
}

export interface Contact {
  id: string
  name: string
  initials: string
  pixKey: string
  bank: string
  lastAmount?: number
}

export interface CardInfo {
  id: string
  brand: 'Visa' | 'Mastercard'
  label: string
  last4: string
  holder: string
  expiry: string
  cvv: string
  number: string
  limit: number
  used: number
  blocked: boolean
  virtual: boolean
  color: 'lime' | 'ink' | 'gold'
}

export const user = {
  name: 'Camila Ribeiro Santos',
  firstName: 'Camila',
  cpf: '428.917.365-02',
  email: 'camila.ribeiro@email.com',
  phone: '+55 11 98765-4321',
  account: '00012345-6',
  agency: '0001',
  bank: 'Timó Instituição de Pagamento',
  bankCode: '401',
  memberSince: 'Março 2023',
  avatarHue: 145,
}

export const balances = {
  available: 12847.63,
  blocked: 0,
  invested: 3500.0,
  yieldMonth: 42.18,
  cashbackMonth: 27.9,
}

export const pixKeys: PixKey[] = [
  {
    id: 'k1',
    type: 'cpf',
    value: '428.917.365-02',
    label: 'CPF',
    primary: true,
  },
  {
    id: 'k2',
    type: 'email',
    value: 'camila.ribeiro@email.com',
    label: 'E-mail',
    primary: false,
  },
  {
    id: 'k3',
    type: 'phone',
    value: '+55 11 98765-4321',
    label: 'Celular',
    primary: false,
  },
  {
    id: 'k4',
    type: 'random',
    value: 'a7f3c2e1-9b4d-4e8a-b1c0-6d5e4f3a2b1c',
    label: 'Chave aleatória',
    primary: false,
  },
]

export const contacts: Contact[] = [
  { id: 'c1', name: 'João Pedro Almeida', initials: 'JP', pixKey: '11987654321', bank: 'Nubank', lastAmount: 150 },
  { id: 'c2', name: 'Marina Costa', initials: 'MC', pixKey: 'marina.costa@gmail.com', bank: 'Inter', lastAmount: 89.9 },
  { id: 'c3', name: 'Rafael Souza', initials: 'RS', pixKey: '391.552.847-10', bank: 'Itaú', lastAmount: 1200 },
  { id: 'c4', name: 'Ana Beatriz Lima', initials: 'AB', pixKey: 'ana.lima@empresa.com.br', bank: 'Bradesco', lastAmount: 45 },
  { id: 'c5', name: 'Lucas Ferreira', initials: 'LF', pixKey: '11976543210', bank: 'C6 Bank', lastAmount: 320 },
  { id: 'c6', name: 'Padaria Pão Quente', initials: 'PQ', pixKey: '12.345.678/0001-90', bank: 'Sicoob', lastAmount: 28.5 },
]

export const cards: CardInfo[] = [
  {
    id: 'card1',
    brand: 'Mastercard',
    label: 'Timó Virtual',
    last4: '4821',
    holder: 'CAMILA R SANTOS',
    expiry: '09/28',
    cvv: '347',
    number: '5531 9248 7730 4821',
    limit: 8000,
    used: 2145.7,
    blocked: false,
    virtual: true,
    color: 'lime',
  },
  {
    id: 'card2',
    brand: 'Visa',
    label: 'Timó Físico',
    last4: '0193',
    holder: 'CAMILA R SANTOS',
    expiry: '03/29',
    cvv: '812',
    number: '4532 1109 8844 0193',
    limit: 12000,
    used: 4890.25,
    blocked: false,
    virtual: false,
    color: 'ink',
  },
]

export const transactions: Transaction[] = [
  {
    id: 't1',
    type: 'pix_in',
    title: 'PIX recebido',
    subtitle: 'João Pedro Almeida',
    amount: 350.0,
    date: '2026-11-27',
    time: '19:42',
    status: 'completed',
    category: 'Transferência',
  },
  {
    id: 't2',
    type: 'card',
    title: 'iFood *Restaurante',
    subtitle: 'Cartão virtual •••• 4821',
    amount: -67.9,
    date: '2026-11-27',
    time: '13:15',
    status: 'completed',
    category: 'Alimentação',
  },
  {
    id: 't3',
    type: 'pix_out',
    title: 'PIX enviado',
    subtitle: 'Marina Costa',
    amount: -89.9,
    date: '2026-11-26',
    time: '21:03',
    status: 'completed',
    category: 'Transferência',
  },
  {
    id: 't4',
    type: 'salary',
    title: 'Salário',
    subtitle: 'NovaEra Tech Ltda',
    amount: 8750.0,
    date: '2026-11-25',
    time: '08:00',
    status: 'completed',
    category: 'Renda',
  },
  {
    id: 't5',
    type: 'boleto',
    title: 'Conta de luz',
    subtitle: 'Enel SP',
    amount: -186.42,
    date: '2026-11-24',
    time: '10:22',
    status: 'completed',
    category: 'Contas',
  },
  {
    id: 't6',
    type: 'card',
    title: 'Uber *Trip',
    subtitle: 'Cartão físico •••• 0193',
    amount: -32.15,
    date: '2026-11-24',
    time: '08:47',
    status: 'completed',
    category: 'Transporte',
  },
  {
    id: 't7',
    type: 'cashback',
    title: 'Cashback Timó',
    subtitle: 'Compra iFood',
    amount: 3.39,
    date: '2026-11-23',
    time: '14:01',
    status: 'completed',
    category: 'Benefício',
  },
  {
    id: 't8',
    type: 'pix_out',
    title: 'PIX enviado',
    subtitle: 'Rafael Souza',
    amount: -1200.0,
    date: '2026-11-22',
    time: '16:30',
    status: 'completed',
    category: 'Transferência',
  },
  {
    id: 't9',
    type: 'ted',
    title: 'TED recebida',
    subtitle: 'Banco Inter • Conta investimento',
    amount: 2000.0,
    date: '2026-11-21',
    time: '11:18',
    status: 'completed',
    category: 'Transferência',
  },
  {
    id: 't10',
    type: 'card',
    title: 'Farmácia Drogasil',
    subtitle: 'Cartão virtual •••• 4821',
    amount: -54.8,
    date: '2026-11-20',
    time: '19:55',
    status: 'completed',
    category: 'Saúde',
  },
  {
    id: 't11',
    type: 'pix_in',
    title: 'PIX recebido',
    subtitle: 'Ana Beatriz Lima',
    amount: 120.0,
    date: '2026-11-19',
    time: '12:40',
    status: 'completed',
    category: 'Transferência',
  },
  {
    id: 't12',
    type: 'boleto',
    title: 'Internet fibra',
    subtitle: 'Vivo Fibra',
    amount: -119.9,
    date: '2026-11-18',
    time: '09:10',
    status: 'completed',
    category: 'Contas',
  },
  {
    id: 't13',
    type: 'card',
    title: 'Netflix.com',
    subtitle: 'Cartão físico •••• 0193',
    amount: -55.9,
    date: '2026-11-17',
    time: '00:05',
    status: 'completed',
    category: 'Assinaturas',
  },
  {
    id: 't14',
    type: 'pix_out',
    title: 'PIX enviado',
    subtitle: 'Padaria Pão Quente',
    amount: -28.5,
    date: '2026-11-16',
    time: '07:35',
    status: 'completed',
    category: 'Alimentação',
  },
  {
    id: 't15',
    type: 'fee',
    title: 'Tarifa isenta',
    subtitle: 'Manutenção de conta Timó',
    amount: 0,
    date: '2026-11-15',
    time: '00:01',
    status: 'completed',
    category: 'Tarifas',
  },
]

export const quickActions = [
  { id: 'pix', label: 'Área PIX', path: '/pix', icon: 'pix' },
  { id: 'transfer', label: 'Transferir', path: '/transferir', icon: 'transfer' },
  { id: 'pay', label: 'Pagar', path: '/pagar', icon: 'pay' },
  { id: 'deposit', label: 'Depositar', path: '/depositar', icon: 'deposit' },
  { id: 'cards', label: 'Cartões', path: '/cartoes', icon: 'card' },
  { id: 'statement', label: 'Extrato', path: '/extrato', icon: 'statement' },
] as const

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function formatDateLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  const today = new Date('2026-11-27T12:00:00')
  const yesterday = new Date('2026-11-26T12:00:00')
  if (d.toDateString() === today.toDateString()) return 'Hoje'
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

export function groupTransactions(txs: Transaction[]) {
  const map = new Map<string, Transaction[]>()
  for (const tx of txs) {
    const key = tx.date
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(tx)
  }
  return Array.from(map.entries()).map(([date, items]) => ({
    date,
    label: formatDateLabel(date),
    items,
    total: items.reduce((s, t) => s + t.amount, 0),
  }))
}
