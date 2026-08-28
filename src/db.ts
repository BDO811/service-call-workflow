import Dexie, { type EntityTable } from 'dexie'

export const STATUSES = [
  'Pending Scheduling',
  'Scheduled',
  'Quote Needed Approval',
  'Quote Approved',
  'Ready for Invoicing',
  'Closed',
] as const

export type Status = (typeof STATUSES)[number]

export const DOC_TYPES = ['work_order', 'invoice', 'estimate', 'photo', 'other'] as const
export type DocType = (typeof DOC_TYPES)[number]

export interface Customer {
  id?: number
  name: string
  phone: string
  email: string
  address: string
  notes: string
  createdAt: number
}

export interface ActivityEntry {
  ts: number
  note: string
}

export type OrderSource = 'manual' | 'email'

export interface WorkOrder {
  id?: number
  claimNumber: string
  customerId: number
  brand: string
  model: string
  serial: string
  reportedProblem: string
  appointmentPreference: string
  authorizationLimit: string
  repairRate: string
  notes: string
  status: Status
  technicianName: string
  technicianContact: string
  sentToTechnicianAt: number | null
  createdAt: number
  updatedAt: number
  activityLog: ActivityEntry[]
  source: OrderSource
  vendorName: string
  vendorContactName: string
  vendorEmail: string
  needsReview: boolean
  rawEmailText: string
}

export interface DocumentRecord {
  id?: number
  workOrderId: number
  name: string
  docType: DocType
  fileBlob: Blob
  uploadedAt: number
}

export const db = new Dexie('ServiceCallWorkflowDB') as Dexie & {
  customers: EntityTable<Customer, 'id'>
  workOrders: EntityTable<WorkOrder, 'id'>
  documents: EntityTable<DocumentRecord, 'id'>
}

db.version(1).stores({
  customers: '++id, name, phone, email',
  workOrders: '++id, claimNumber, customerId, status, createdAt',
  documents: '++id, workOrderId, docType',
})

db.version(2)
  .stores({
    customers: '++id, name, phone, email',
    workOrders: '++id, claimNumber, customerId, status, createdAt, source',
    documents: '++id, workOrderId, docType',
  })
  .upgrade(async (tx) => {
    await tx
      .table('workOrders')
      .toCollection()
      .modify((o: WorkOrder) => {
        o.source = o.source ?? 'manual'
        o.vendorName = o.vendorName ?? ''
        o.vendorEmail = o.vendorEmail ?? ''
        o.needsReview = o.needsReview ?? false
        o.rawEmailText = o.rawEmailText ?? ''
      })
  })

db.version(3)
  .stores({
    customers: '++id, name, phone, email',
    workOrders: '++id, claimNumber, customerId, status, createdAt, source',
    documents: '++id, workOrderId, docType',
  })
  .upgrade(async (tx) => {
    await tx
      .table('workOrders')
      .toCollection()
      .modify((o: WorkOrder) => {
        o.vendorContactName = o.vendorContactName ?? ''
      })
  })

export function logActivity(order: WorkOrder, note: string): ActivityEntry[] {
  return [...order.activityLog, { ts: Date.now(), note }]
}
