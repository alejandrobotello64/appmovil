export type ServiceContract = {
  id: string;
  contractNumber: string;
  title: string;
  clientId: string | null;
  tenderId: string | null;
  startsOn: string;
  endsOn: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ServiceContractInput = {
  contractNumber: string;
  title: string;
  clientId: string | null;
  tenderId: string | null;
  startsOn: string;
  endsOn: string;
  notes: string;
  isActive: boolean;
};

export function contractLabel(contract: Pick<ServiceContract, "contractNumber" | "title">) {
  const number = contract.contractNumber.trim();
  const title = contract.title.trim();
  return title ? `${number} · ${title}` : number;
}
