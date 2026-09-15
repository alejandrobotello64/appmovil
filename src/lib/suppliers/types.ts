export type Supplier = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  rfc: string;
  address: string;
  city: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SupplierInput = Omit<
  Supplier,
  "id" | "createdAt" | "updatedAt"
>;
