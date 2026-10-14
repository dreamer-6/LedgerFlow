import React from 'react';
import {
  NormalizedInvoiceData,
  InvoiceVisibilityOptions
} from './InvoiceAdapter';
import { StandardInvoice } from './StandardInvoice';
import { SimpleInvoice } from './SimpleInvoice';
import { ThermalInvoice } from './ThermalInvoice';

export type InvoiceLayoutType = 'Standard' | 'Simple' | 'Thermal';

interface InvoiceRendererProps {
  data: NormalizedInvoiceData;
  layout?: InvoiceLayoutType;
  options?: InvoiceVisibilityOptions;
  id?: string;
}

export const InvoiceRenderer: React.FC<InvoiceRendererProps> = ({
  data,
  layout = 'Standard',
  options = {},
  id = 'printable-tax-invoice'
}) => {
  switch (layout) {
    case 'Simple':
      return <SimpleInvoice data={data} options={options} id={id} />;
    case 'Thermal':
      return <ThermalInvoice data={data} options={options} id={id} />;
    case 'Standard':
    default:
      return <StandardInvoice data={data} options={options} id={id} />;
  }
};
