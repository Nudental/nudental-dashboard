import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import { Checkbox } from '../../../components/ui/Checkbox';

const TransactionGrid = ({ transactions, onEdit, onBulkAction }) => {
  const [selectedRows, setSelectedRows] = useState([]);
  const [editingRow, setEditingRow] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  const transactionTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'collection', label: 'Collections' },
    { value: 'production', label: 'Production' },
    { value: 'expense', label: 'Expenses' },
    { value: 'adjustment', label: 'Adjustments' }
  ];

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedRows(transactions?.map(t => t?.id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (id, checked) => {
    if (checked) {
      setSelectedRows([...selectedRows, id]);
    } else {
      setSelectedRows(selectedRows?.filter(rowId => rowId !== id));
    }
  };

  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig?.key === key && sortConfig?.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      approved: 'bg-success/10 text-success border-success/20',
      pending: 'bg-warning/10 text-warning border-warning/20',
      rejected: 'bg-error/10 text-error border-error/20',
      draft: 'bg-muted text-muted-foreground border-border'
    };

    return (
      <span className={`text-xs px-2 py-1 rounded border ${statusStyles?.[status] || statusStyles?.draft}`}>
        {status?.toUpperCase()}
      </span>
    );
  };

  const filteredTransactions = transactions?.filter(t => {
    const matchesSearch = t?.description?.toLowerCase()?.includes(searchTerm?.toLowerCase()) || 
                         t?.provider?.toLowerCase()?.includes(searchTerm?.toLowerCase());
    const matchesType = filterType === 'all' || t?.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 md:p-6 border-b border-border">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4">
          <h3 className="text-base md:text-lg font-semibold text-foreground">Transaction History</h3>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <Input
              type="search"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e?.target?.value)}
              className="flex-1 lg:flex-none lg:w-64"
            />
            <Select
              options={transactionTypes}
              value={filterType}
              onChange={setFilterType}
              className="w-full sm:w-48"
            />
          </div>
        </div>
        {selectedRows?.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-3 bg-muted rounded-lg">
            <span className="text-sm text-foreground">{selectedRows?.length} selected</span>
            <Button variant="outline" size="sm" iconName="Check" onClick={() => onBulkAction('approve')}>
              Approve
            </Button>
            <Button variant="outline" size="sm" iconName="X" onClick={() => onBulkAction('reject')}>
              Reject
            </Button>
            <Button variant="outline" size="sm" iconName="Download" onClick={() => onBulkAction('export')}>
              Export
            </Button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left">
                <Checkbox
                  checked={selectedRows?.length === transactions?.length}
                  onChange={(e) => handleSelectAll(e?.target?.checked)}
                  size="sm"
                />
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('date')}
                  className="flex items-center gap-2 text-xs font-medium text-foreground hover:text-primary transition-smooth"
                >
                  Date
                  <Icon name={sortConfig?.key === 'date' && sortConfig?.direction === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={14} />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-foreground">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-foreground">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-foreground">Provider</th>
              <th className="px-4 py-3 text-right">
                <button
                  onClick={() => handleSort('amount')}
                  className="flex items-center gap-2 text-xs font-medium text-foreground hover:text-primary transition-smooth ml-auto"
                >
                  Amount
                  <Icon name={sortConfig?.key === 'amount' && sortConfig?.direction === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={14} />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-foreground">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredTransactions?.map((transaction) => (
              <tr key={transaction?.id} className="hover:bg-muted/50 transition-smooth">
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selectedRows?.includes(transaction?.id)}
                    onChange={(e) => handleSelectRow(transaction?.id, e?.target?.checked)}
                    size="sm"
                  />
                </td>
                <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">{transaction?.date}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">
                    {transaction?.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-foreground">{transaction?.description}</td>
                <td className="px-4 py-3 text-sm text-foreground">{transaction?.provider}</td>
                <td className="px-4 py-3 text-sm font-medium text-foreground text-right whitespace-nowrap">
                  ${transaction?.amount?.toLocaleString()}
                </td>
                <td className="px-4 py-3">{getStatusBadge(transaction?.status)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      iconName="Edit"
                      iconSize={16}
                      onClick={() => onEdit(transaction?.id)}
                      aria-label="Edit transaction"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      iconName="Eye"
                      iconSize={16}
                      aria-label="View details"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Showing {filteredTransactions?.length} of {transactions?.length} transactions
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" iconName="ChevronLeft">
            Previous
          </Button>
          <Button variant="outline" size="sm">
            1
          </Button>
          <Button variant="outline" size="sm">
            2
          </Button>
          <Button variant="outline" size="sm">
            3
          </Button>
          <Button variant="outline" size="sm" iconName="ChevronRight" iconPosition="right">
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TransactionGrid;