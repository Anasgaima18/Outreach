import { useState } from 'react';
import { Users, Plus, Upload, Download, Search, Filter, Edit, Trash2, Globe, Mail } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/shared/EmptyState';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { ContactModal } from '../components/contacts/ContactModal';
import { DeleteContactDialog } from '../components/contacts/DeleteContactDialog';
import { CsvImportModal } from '../components/contacts/CsvImportModal';
import { useContacts } from '../hooks/useContacts';
import type { Contact, ContactStatus } from '../types/database.types';

export function ContactsPage() {
  const {
    contacts,
    filteredContacts,
    distinctOptions,
    filters,
    setFilters,
    loading,
    error,
    addContact,
    updateContact,
    deleteContact,
    validateCsvRows,
    importContacts,
    exportContactsCsv,
  } = useContacts();

  // Modal states
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [targetDeleteContact, setTargetDeleteContact] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [csvModalOpen, setCsvModalOpen] = useState(false);

  const handleOpenAdd = () => {
    setEditingContact(null);
    setContactModalOpen(true);
  };

  const handleOpenEdit = (contact: Contact) => {
    setEditingContact(contact);
    setContactModalOpen(true);
  };

  const handleSaveContact = async (contactData: Partial<Contact>) => {
    if (editingContact) {
      return await updateContact(editingContact.id, contactData);
    } else {
      return await addContact(contactData as any);
    }
  };

  const handleOpenDelete = (contact: Contact) => {
    setTargetDeleteContact(contact);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!targetDeleteContact) return;
    setDeleting(true);
    await deleteContact(targetDeleteContact.id);
    setDeleting(false);
    setDeleteDialogOpen(false);
    setTargetDeleteContact(null);
  };

  const handleExport = () => {
    exportContactsCsv(filteredContacts.length > 0 ? filteredContacts : contacts);
  };

  const getStatusBadge = (status: ContactStatus) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'contacted':
        return <Badge variant="default">Contacted</Badge>;
      case 'replied':
        return <Badge variant="warning">Replied</Badge>;
      case 'unsubscribed':
        return <Badge variant="destructive">Unsubscribed</Badge>;
      case 'bounced':
        return <Badge variant="destructive">Bounced</Badge>;
      case 'suppressed':
        return <Badge variant="secondary">Suppressed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">Professor & Educator Contacts</h2>
          <p className="text-sm text-gray-500">
            Targeted educator directory with institution, department, and role metadata (any email supported).
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" size="sm" onClick={() => setCsvModalOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button size="sm" onClick={handleOpenAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
          {error}
        </div>
      )}

      {/* Search & Multi-Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by professor name, university, or email..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-gray-50/50 pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filters.country}
              onChange={(e) => setFilters({ ...filters, country: e.target.value })}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Countries</option>
              {distinctOptions.countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="contacted">Contacted</option>
              <option value="replied">Replied</option>
              <option value="unsubscribed">Unsubscribed</option>
              <option value="bounced">Bounced</option>
              <option value="suppressed">Suppressed</option>
            </select>

            {distinctOptions.institutions.length > 0 && (
              <select
                value={filters.institution}
                onChange={(e) => setFilters({ ...filters, institution: e.target.value })}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 focus:border-blue-500 focus:outline-none max-w-[150px] truncate"
              >
                <option value="all">All Institutions</option>
                {distinctOptions.institutions.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            )}

            {(filters.searchQuery || filters.country !== 'all' || filters.status !== 'all' || filters.institution !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({ searchQuery: '', country: 'all', institution: 'all', department: 'all', status: 'all' })}
                className="text-xs text-gray-500"
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
          <span>
            Showing <strong>{filteredContacts.length}</strong> of <strong>{contacts.length}</strong> contacts
          </span>
          {filteredContacts.length < contacts.length && (
            <span className="text-blue-600 font-medium">Filtered</span>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span className="ml-3 text-sm text-gray-500">Loading contacts...</span>
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No Contacts Yet"
          description="Add any email address — professor, corporate, or personal — or import a CSV to get started."
          actionLabel="Import CSV"
          onAction={() => setCsvModalOpen(true)}
        />
      ) : filteredContacts.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-xs">
          <p className="text-sm font-semibold text-gray-700">No contacts match your current search or filters.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setFilters({ searchQuery: '', country: 'all', institution: 'all', department: 'all', status: 'all' })}
          >
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact & Email</TableHead>
                <TableHead>Institution & Department</TableHead>
                <TableHead>Academic Role</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <div className="font-semibold text-gray-900">{contact.full_name}</div>
                    <div className="text-xs font-mono text-gray-500 flex items-center gap-1.5 mt-0.5">
                      <Mail className="h-3 w-3 text-gray-400" />
                      {contact.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium text-gray-800">{contact.institution || '—'}</div>
                    <div className="text-[11px] text-gray-500">{contact.department || ''}</div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-gray-700">{contact.academic_role || '—'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-gray-700">{contact.country || '—'}</span>
                  </TableCell>
                  <TableCell>{getStatusBadge(contact.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {contact.website && (
                        <a
                          href={contact.website}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                          title="Open Academic Website"
                        >
                          <Globe className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(contact)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                        title="Edit Contact"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDelete(contact)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors"
                        title="Delete Contact"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add / Edit Contact Modal */}
      <ContactModal
        open={contactModalOpen}
        onOpenChange={setContactModalOpen}
        contact={editingContact}
        onSave={handleSaveContact}
      />

      {/* Delete Contact Dialog */}
      <DeleteContactDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        contact={targetDeleteContact}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />

      {/* CSV Import Modal */}
      <CsvImportModal
        open={csvModalOpen}
        onOpenChange={setCsvModalOpen}
        onValidate={validateCsvRows}
        onImport={importContacts}
      />
    </div>
  );
}

export default ContactsPage;
