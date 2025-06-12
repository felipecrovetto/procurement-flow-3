// Procurement Management System - Frontend JavaScript

// Global variables
let currentPage = 1;
let currentSection = 'dashboard';
let charts = {};

// API Base URL
const API_BASE = '/api';

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Load dashboard by default
    showSection('dashboard');
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Load initial data
    loadDashboardData();
    
    // Check for alerts periodically
    setInterval(updateAlertBadge, 30000); // Every 30 seconds
}

function initializeEventListeners() {
    // Excel upload form
    const excelForm = document.getElementById('excelUploadForm');
    if (excelForm) {
        excelForm.addEventListener('submit', handleExcelUpload);
    }
    
    // Search inputs
    const searchInputs = ['processSearch', 'supplierSearch'];
    searchInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('keyup', debounce(function() {
                if (inputId.includes('process')) loadProcesses();
                if (inputId.includes('supplier')) loadSuppliers();
            }, 500));
        }
    });
}

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showLoading() {
    try {
        const loadingModalEl = document.getElementById('loadingModal');
        if (loadingModalEl) {
            // Cerrar cualquier modal existente primero
            const existingModal = bootstrap.Modal.getInstance(loadingModalEl);
            if (existingModal) {
                existingModal.hide();
            }
            
            // Crear y mostrar nuevo modal
            const modal = new bootstrap.Modal(loadingModalEl, {
                backdrop: 'static',
                keyboard: false
            });
            modal.show();
            
            // Timeout de seguridad para evitar que se quede cargando indefinidamente
            setTimeout(() => {
                hideLoading();
            }, 30000); // 30 segundos máximo
        }
    } catch (error) {
        console.error('Error showing loading modal:', error);
    }
}

function hideLoading() {
    try {
        const loadingModalEl = document.getElementById('loadingModal');
        if (loadingModalEl) {
            // Intentar obtener instancia existente
            let modal = bootstrap.Modal.getInstance(loadingModalEl);
            
            if (modal) {
                modal.hide();
            } else {
                // Si no hay instancia, crear una y ocultarla inmediatamente
                modal = new bootstrap.Modal(loadingModalEl);
                modal.hide();
            }
            
            // Forzar ocultación después de un breve delay
            setTimeout(() => {
                loadingModalEl.classList.remove('show');
                loadingModalEl.style.display = 'none';
                document.body.classList.remove('modal-open');
                
                // Remover backdrop si existe
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) {
                    backdrop.remove();
                }
            }, 100);
        }
    } catch (error) {
        console.error('Error hiding loading modal:', error);
        // Forzar ocultación en caso de error
        const loadingModalEl = document.getElementById('loadingModal');
        if (loadingModalEl) {
            loadingModalEl.classList.remove('show');
            loadingModalEl.style.display = 'none';
            document.body.classList.remove('modal-open');
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) backdrop.remove();
        }
    }
}

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Insert at the top of the current section
    const currentSectionEl = document.getElementById(currentSection);
    currentSectionEl.insertBefore(alertDiv, currentSectionEl.firstChild);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP'
    }).format(amount);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-CL');
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('es-CL');
}

// Navigation Functions
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Show selected section
    const section = document.getElementById(sectionName);
    if (section) {
        section.style.display = 'block';
        currentSection = sectionName;
        
        // Update navbar active state
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Load section-specific data
        switch(sectionName) {
            case 'dashboard':
                loadDashboardData();
                break;
            case 'processes':
                loadProcesses();
                break;
            case 'suppliers':
                loadSuppliers();
                break;
            case 'bids':
                loadBids();
                break;
            case 'documents':
                loadDocuments();
                break;
            case 'alerts':
                loadAlerts();
                break;
            case 'excel':
                // Excel section doesn't need initial data load
                break;
            case 'reports':
                loadReports();
                break;
        }
    }
}

// Dashboard Functions
async function loadDashboardData() {
    try {
        const response = await fetch(`${API_BASE}/reports/dashboard`);
        const data = await response.json();
        
        if (response.ok) {
            updateDashboardCounters(data.counters);
            updateDashboardCharts(data);
            updateRecentProcesses(data.recent_processes);
            updateActiveAlerts(data.alert_priority_distribution);
        } else {
            showAlert('Error cargando datos del dashboard: ' + data.error, 'danger');
        }
    } catch (error) {
        showAlert('Error de conexión al cargar dashboard', 'danger');
        console.error('Dashboard load error:', error);
    }
}

function updateDashboardCounters(counters) {
    document.getElementById('totalProcesses').textContent = counters.total_processes || 0;
    document.getElementById('totalSuppliers').textContent = counters.total_suppliers || 0;
    document.getElementById('totalBids').textContent = counters.total_bids || 0;
    document.getElementById('activeAlerts').textContent = counters.active_alerts || 0;
    
    // Update alert badge
    updateAlertBadge();
}

function updateDashboardCharts(data) {
    // Status distribution chart
    const statusCtx = document.getElementById('statusChart');
    if (statusCtx && data.process_status_distribution) {
        if (charts.statusChart) charts.statusChart.destroy();
        
        charts.statusChart = new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: data.process_status_distribution.map(item => item.status),
                datasets: [{
                    data: data.process_status_distribution.map(item => item.count),
                    backgroundColor: [
                        '#6c757d', // draft
                        '#198754', // active
                        '#ffc107', // evaluation
                        '#0dcaf0', // completed
                        '#dc3545'  // cancelled
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    // Type distribution chart
    const typeCtx = document.getElementById('typeChart');
    if (typeCtx && data.process_type_distribution) {
        if (charts.typeChart) charts.typeChart.destroy();
        
        charts.typeChart = new Chart(typeCtx, {
            type: 'pie',
            data: {
                labels: data.process_type_distribution.map(item => 
                    item.type === 'simple_purchase' ? 'Compra Simple' : 'Licitación Grande'
                ),
                datasets: [{
                    data: data.process_type_distribution.map(item => item.count),
                    backgroundColor: ['#0d6efd', '#20c997']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
}

function updateRecentProcesses(processes) {
    const container = document.getElementById('recentProcesses');
    if (!container) return;
    
    if (!processes || processes.length === 0) {
        container.innerHTML = '<p class="text-muted">No hay procesos recientes</p>';
        return;
    }
    
    const html = processes.map(process => `
        <div class="d-flex justify-content-between align-items-center border-bottom py-2">
            <div>
                <h6 class="mb-1">${process.process_number}</h6>
                <p class="mb-0 text-muted small">${process.title}</p>
            </div>
            <span class="badge status-${process.status}">${process.status}</span>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

function updateActiveAlerts(alertData) {
    const container = document.getElementById('activeAlertsList');
    if (!container) return;
    
    if (!alertData || alertData.length === 0) {
        container.innerHTML = '<p class="text-muted">No hay alertas activas</p>';
        return;
    }
    
    const html = alertData.map(alert => `
        <div class="d-flex justify-content-between align-items-center border-bottom py-2">
            <div>
                <span class="badge priority-${alert.priority}">${alert.priority}</span>
            </div>
            <span class="fw-bold">${alert.count}</span>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

async function updateAlertBadge() {
    try {
        const response = await fetch(`${API_BASE}/alerts/stats`);
        const data = await response.json();
        
        if (response.ok) {
            const badge = document.getElementById('alertBadge');
            const activeAlerts = data.by_status?.active || 0;
            
            if (activeAlerts > 0) {
                badge.textContent = activeAlerts;
                badge.style.display = 'inline';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error updating alert badge:', error);
    }
}

// Process Functions
async function loadProcesses(page = 1) {
    try {
        const search = document.getElementById('processSearch')?.value || '';
        const status = document.getElementById('processStatusFilter')?.value || '';
        const type = document.getElementById('processTypeFilter')?.value || '';
        
        const params = new URLSearchParams({
            page: page,
            per_page: 10,
            search: search,
            status: status,
            process_type: type
        });
        
        const response = await fetch(`${API_BASE}/processes?${params}`);
        const data = await response.json();
        
        if (response.ok) {
            updateProcessesTable(data.processes);
            updatePagination('processes', data.current_page, data.pages);
        } else {
            showAlert('Error cargando procesos: ' + data.error, 'danger');
        }
    } catch (error) {
        showAlert('Error de conexión al cargar procesos', 'danger');
        console.error('Processes load error:', error);
    }
}

function updateProcessesTable(processes) {
    const tbody = document.getElementById('processesTableBody');
    if (!tbody) return;
    
    if (!processes || processes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No se encontraron procesos</td></tr>';
        return;
    }
    
    const html = processes.map(process => `
        <tr>
            <td>${process.process_number}</td>
            <td>${process.title}</td>
            <td>${process.process_type === 'simple_purchase' ? 'Compra Simple' : 'Licitación Grande'}</td>
            <td><span class="badge status-${process.status}">${process.status}</span></td>
            <td>${process.budget ? formatCurrency(process.budget) : '-'}</td>
            <td>${formatDate(process.end_date)}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="editProcess(${process.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteProcess(${process.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    tbody.innerHTML = html;
}

function showProcessModal(processId = null) {
    const modal = new bootstrap.Modal(document.getElementById('processModal'));
    const form = document.getElementById('processForm');
    
    // Reset form
    form.reset();
    document.getElementById('processId').value = '';
    
    if (processId) {
        // Load process data for editing
        loadProcessForEdit(processId);
    }
    
    modal.show();
}

async function loadProcessForEdit(processId) {
    try {
        const response = await fetch(`${API_BASE}/processes/${processId}`);
        const process = await response.json();
        
        if (response.ok) {
            document.getElementById('processId').value = process.id;
            document.getElementById('processNumber').value = process.process_number;
            document.getElementById('processTitle').value = process.title;
            document.getElementById('processDescription').value = process.description || '';
            document.getElementById('processType').value = process.process_type;
            document.getElementById('processStatus').value = process.status;
            document.getElementById('processBudget').value = process.budget || '';
            document.getElementById('processNotes').value = process.notes || '';
            
            if (process.start_date) {
                document.getElementById('processStartDate').value = new Date(process.start_date).toISOString().slice(0, 16);
            }
            if (process.end_date) {
                document.getElementById('processEndDate').value = new Date(process.end_date).toISOString().slice(0, 16);
            }
        } else {
            showAlert('Error cargando proceso: ' + process.error, 'danger');
        }
    } catch (error) {
        showAlert('Error de conexión al cargar proceso', 'danger');
        console.error('Process load error:', error);
    }
}

async function saveProcess() {
    const form = document.getElementById('processForm');
    const formData = new FormData(form);
    
    const processData = {
        process_number: document.getElementById('processNumber').value,
        title: document.getElementById('processTitle').value,
        description: document.getElementById('processDescription').value,
        process_type: document.getElementById('processType').value,
        status: document.getElementById('processStatus').value,
        budget: document.getElementById('processBudget').value ? parseFloat(document.getElementById('processBudget').value) : null,
        start_date: document.getElementById('processStartDate').value || null,
        end_date: document.getElementById('processEndDate').value || null,
        notes: document.getElementById('processNotes').value
    };
    
    const processId = document.getElementById('processId').value;
    const isEdit = processId !== '';
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE}/processes${isEdit ? '/' + processId : ''}`, {
            method: isEdit ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(processData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(`Proceso ${isEdit ? 'actualizado' : 'creado'} exitosamente`, 'success');
            bootstrap.Modal.getInstance(document.getElementById('processModal')).hide();
            loadProcesses();
        } else {
            showAlert('Error guardando proceso: ' + result.error, 'danger');
        }
    } catch (error) {
        showAlert('Error de conexión al guardar proceso', 'danger');
        console.error('Process save error:', error);
    } finally {
        hideLoading();
    }
}

function editProcess(processId) {
    showProcessModal(processId);
}

async function deleteProcess(processId) {
    if (!confirm('¿Está seguro de que desea eliminar este proceso?')) {
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE}/processes/${processId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert('Proceso eliminado exitosamente', 'success');
            loadProcesses();
        } else {
            showAlert('Error eliminando proceso: ' + result.error, 'danger');
        }
    } catch (error) {
        showAlert('Error de conexión al eliminar proceso', 'danger');
        console.error('Process delete error:', error);
    } finally {
        hideLoading();
    }
}

async function exportProcesses() {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE}/reports/export/processes`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `procesos_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showAlert('Archivo exportado exitosamente', 'success');
        } else {
            const error = await response.json();
            showAlert('Error exportando procesos: ' + error.error, 'danger');
        }
    } catch (error) {
        showAlert('Error de conexión al exportar procesos', 'danger');
        console.error('Export error:', error);
    } finally {
        hideLoading();
    }
}

// Supplier Functions
async function loadSuppliers(page = 1) {
    try {
        const search = document.getElementById('supplierSearch')?.value || '';
        const status = document.getElementById('supplierStatusFilter')?.value || '';
        
        const params = new URLSearchParams({
            page: page,
            per_page: 10,
            search: search,
            status: status
        });
        
        const response = await fetch(`${API_BASE}/suppliers?${params}`);
        const data = await response.json();
        
        if (response.ok) {
            updateSuppliersTable(data.suppliers);
            updatePagination('suppliers', data.current_page, data.pages);
        } else {
            showAlert('Error cargando proveedores: ' + data.error, 'danger');
        }
    } catch (error) {
        showAlert('Error de conexión al cargar proveedores', 'danger');
        console.error('Suppliers load error:', error);
    }
}

function updateSuppliersTable(suppliers) {
    const tbody = document.getElementById('suppliersTableBody');
    if (!tbody) return;
    
    if (!suppliers || suppliers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No se encontraron proveedores</td></tr>';
        return;
    }
    
    const html = suppliers.map(supplier => `
        <tr>
            <td>${supplier.name}</td>
            <td>${supplier.contact_person || '-'}</td>
            <td>${supplier.email || '-'}</td>
            <td>${supplier.phone || '-'}</td>
            <td>${supplier.rut || '-'}</td>
            <td><span class="badge status-${supplier.status}">${supplier.status}</span></td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="editSupplier(${supplier.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteSupplier(${supplier.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    tbody.innerHTML = html;
}

function showSupplierModal(supplierId = null) {
    const modal = new bootstrap.Modal(document.getElementById('supplierModal'));
    const form = document.getElementById('supplierForm');
    
    // Reset form
    form.reset();
    document.getElementById('supplierId').value = '';
    
    if (supplierId) {
        // Load supplier data for editing
        loadSupplierForEdit(supplierId);
    }
    
    modal.show();
}

async function loadSupplierForEdit(supplierId) {
    try {
        const response = await fetch(`${API_BASE}/suppliers/${supplierId}`);
        const supplier = await response.json();
        
        if (response.ok) {
            document.getElementById('supplierId').value = supplier.id;
            document.getElementById('supplierName').value = supplier.name;
            document.getElementById('supplierContact').value = supplier.contact_person || '';
            document.getElementById('supplierEmail').value = supplier.email || '';
            document.getElementById('supplierPhone').value = supplier.phone || '';
            document.getElementById('supplierAddress').value = supplier.address || '';
            document.getElementById('supplierRut').value = supplier.rut || '';
            document.getElementById('supplierStatus').value = supplier.status;
            document.getElementById('supplierNotes').value = supplier.notes || '';
        } else {
            showAlert('Error cargando proveedor: ' + supplier.error, 'danger');
        }
    } catch (error) {
        showAlert('Error de conexión al cargar proveedor', 'danger');
        console.error('Supplier load error:', error);
    }
}

async function saveSupplier() {
    const supplierData = {
        name: document.getElementById('supplierName').value,
        contact_person: document.getElementById('supplierContact').value,
        email: document.getElementById('supplierEmail').value,
        phone: document.getElementById('supplierPhone').value,
        address: document.getElementById('supplierAddress').value,
        rut: document.getElementById('supplierRut').value,
        status: document.getElementById('supplierStatus').value,
        notes: document.getElementById('supplierNotes').value
    };
    
    const supplierId = document.getElementById('supplierId').value;
    const isEdit = supplierId !== '';
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE}/suppliers${isEdit ? '/' + supplierId : ''}`, {
            method: isEdit ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(supplierData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(`Proveedor ${isEdit ? 'actualizado' : 'creado'} exitosamente`, 'success');
            bootstrap.Modal.getInstance(document.getElementById('supplierModal')).hide();
            loadSuppliers();
        } else {
            showAlert('Error guardando proveedor: ' + result.error, 'danger');
        }
    } catch (error) {
        showAlert('Error de conexión al guardar proveedor', 'danger');
        console.error('Supplier save error:', error);
    } finally {
        hideLoading();
    }
}

function editSupplier(supplierId) {
    showSupplierModal(supplierId);
}

async function deleteSupplier(supplierId) {
    if (!confirm('¿Está seguro de que desea eliminar este proveedor?')) {
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE}/suppliers/${supplierId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert('Proveedor eliminado exitosamente', 'success');
            loadSuppliers();
        } else {
            showAlert('Error eliminando proveedor: ' + result.error, 'danger');
        }
    } catch (error) {
        showAlert('Error de conexión al eliminar proveedor', 'danger');
        console.error('Supplier delete error:', error);
    } finally {
        hideLoading();
    }
}

async function exportSuppliers() {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE}/reports/export/suppliers`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `proveedores_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showAlert('Archivo exportado exitosamente', 'success');
        } else {
            const error = await response.json();
            showAlert('Error exportando proveedores: ' + error.error, 'danger');
        }
    } catch (error) {
        showAlert('Error de conexión al exportar proveedores', 'danger');
        console.error('Export error:', error);
    } finally {
        hideLoading();
    }
}

// Bids Functions
async function loadBids(page = 1) {
    try {
        const params = new URLSearchParams({
            page: page,
            per_page: 10
        });
        
        const response = await fetch(`${API_BASE}/bids?${params}`);
        const data = await response.json();
        
        if (response.ok) {
            updateBidsTable(data.bids);
            updatePagination('bids', data.current_page, data.pages);
        } else {
            showAlert('Error cargando ofertas: ' + data.error, 'danger');
        }
    } catch (error) {
        showAlert('Error de conexión al cargar ofertas', 'danger');
        console.error('Bids load error:', error);
    }
}

function updateBidsTable(bids) {
    const tbody = document.getElementById('bidsTableBody');
    if (!tbody) return;
    
    if (!bids || bids.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No se encontraron ofertas</td></tr>';
        return;
    }
    
    const html = bids.map(bid => `
        <tr>
            <td>${bid.process_title || '-'}</td>
            <td>${bid.supplier_name || '-'}</td>
            <td>${bid.bid_amount ? formatCurrency(bid.bid_amount) : '-'}</td>
            <td>${bid.technical_score || '-'}</td>
            <td>${bid.commercial_score || '-'}</td>
            <td><span class="badge status-${bid.status}">${bid.status}</span></td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="editBid(${bid.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteBid(${bid.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    tbody.innerHTML = html;
}

function showBidModal() {
    // Implementation for bid modal
    showAlert('Funcionalidad de ofertas en desarrollo', 'info');
}

function editBid(bidId) {
    showAlert('Funcionalidad de edición de ofertas en desarrollo', 'info');
}

async function deleteBid(bidId) {
    if (!confirm('¿Está seguro de que desea eliminar esta oferta?')) {
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE}/bids/${bidId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert('Oferta eliminada exitosamente', 'success');
            loadBids();
        } else {
            showAlert('Error eliminando oferta: ' + result.error, 'danger');
        }
    } catch (error) {
        showAlert('Error de conexión al eliminar oferta', 'danger');
        console.error('Bid delete error:', error);
    } finally {
        hideLoading();
    }
}

// Documents Functions
async function loadDocuments(page = 1) {
    try {
        const params = new URLSearchParams({
            page: page,
            per_page: 10
        });
        
        const response = await fetch(`${API_BASE}/documents?${params}`);
        const data = await response.json();
        
        if (response.ok) {
            updateDocumentsTable(data.documents);
            updatePagination('documents', data.current_page, data.pages);
        } else {
            showAlert('Error cargando documentos: ' + data.error, 'danger');
        }
    } catch (error) {
        showAlert('Error de conexión al cargar documentos', 'danger');
        console.error('Documents load error:', error);
    }
}

function updateDocumentsTable(documents) {
    const tbody = document.getElementById('documentsTableBody');
    if (!tbody) return;
    
    if (!documents || documents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No se encontraron documentos</td></tr>';
        return;
    }
    
    const html = documents.map(doc => `
        <tr>
            <td>${doc.original_filename}</td>
            <td>${doc.document_type || '-'}</td>
            <td>${doc.process_title || '-'}</td>
            <td>${doc.supplier_name || '-'}</td>
            <td>${formatFileSize(doc.file_size)}</td>
            <td>${formatDate(doc.upload_date)}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="downloadDocument(${doc.id})">
                        <i class="bi bi-download"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteDocument(${doc.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    tbody.innerHTML = html;
}

function formatFileSize(bytes) {
    if (!bytes) return '-';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function showDocumentModal() {
    showAlert('Funcionalidad de subida de documentos en desarrollo', 'info');
}

async function downloadDocument(documentId) {
    try {
        const response = await fetch(`${API_BASE}/documents/${documentId}/download`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = ''; // Filename will be set by server
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            const error = await response.json();
            showAlert('Error descargando documento: ' + error.error, 'danger');
        }
    } catch (error) {
        showAlert('Error de conexión al descargar documento', 'danger');
        console.error('Download error:', error);
    }
}

async function deleteDocument(documentId) {
    if (!confirm('¿Está seguro de que desea eliminar este documento?')) {
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE}/documents/${documentId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert('Documento eliminado exitosamente', 'success');
            loadDocuments();
        } else {
            showAlert('Error eliminando documento: ' + result.error, 'danger');
        }
    } catch (error) {
        showAlert('Error de conexión al eliminar documento', 'danger');
        console.error('Document delete error:', error);
    } finally {
        hideLoading();
    }
}

// Alerts Functions
async function loadAlerts(page = 1) {
    try {
        const params = new URLSearchParams({
            page: page,
            per_page: 10
        });
        
        const response = await fetch(`${API_BASE}/alerts?${params}`);
        const data = await response.json();
        
        if (response.ok) {
            updateAlertsTable(data.alerts);
            updatePagination('alerts', data.current_page, data.pages);
        } else {
            showAlert('Error cargando alertas: ' + data.error, 'danger');
        }
    } catch (error) {
        showAlert('Error de conexión al cargar alertas', 'danger');
        console.error('Alerts load error:', error);
    }
}

function updateAlertsTable(alerts) {
    const tbody = document.getElementById('alertsTableBody');
    if (!tbody) return;
    
    if (!alerts || alerts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No se encontraron alertas</td></tr>';
        return;
    }
    
    const html = alerts.map(alert => `
        <tr>
            <td>${alert.title}</td>
            <td>${alert.alert_type}</td>
            <td><span class="badge priority-${alert.priority}">${alert.priority}</span></td>
            <td><span class="badge status-${alert.status}">${alert.status}</span></td>
            <td>${alert.process_title || '-'}</td>
            <td>${formatDate(alert.created_date)}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-warning" onclick="dismissAlert(${alert.id})">
                        <i class="bi bi-x"></i>
                    </button>
                    <button class="btn btn-outline-success" onclick="resolveAlert(${alert.id})">
                        <i class="bi bi-check"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    tbody.innerHTML = html;
}

function showAlertModal() {
    showAlert('Funcionalidad de creación de alertas en desarrollo', 'info');
}

async function dismissAlert(alertId) {
    try {
        const response = await fetch(`${API_BASE}/alerts/${alertId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'dismissed' })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert('Alerta descartada', 'success');
            loadAlerts();
            updateAlertBadge();
        } else {
            showAlert('Error descartando alerta: ' + result.error, 'danger');
        }
    } catch (error) {
        showAlert('Error de conexión al descartar alerta', 'danger');
        console.error('Alert dismiss error:', error);
    }
}

async function resolveAlert(alertId) {
    try {
        const response = await fetch(`${API_BASE}/alerts/${alertId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'resolved' })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert('Alerta resuelta', 'success');
            loadAlerts();
            updateAlertBadge();
        } else {
            showAlert('Error resolviendo alerta: ' + result.error, 'danger');
        }
    } catch (error) {
        showAlert('Error de conexión al resolver alerta', 'danger');
        console.error('Alert resolve error:', error);
    }
}

async function checkDeadlines() {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE}/alerts/check-deadlines`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message, 'success');
            loadAlerts();
            updateAlertBadge();
        } else {
            showAlert('Error verificando vencimientos: ' + result.error, 'danger');
        }
    } catch (error) {
        showAlert('Error de conexión al verificar vencimientos', 'danger');
        console.error('Check deadlines error:', error);
    } finally {
        hideLoading();
    }
}

// Excel Functions
async function handleExcelUpload(event) {
    event.preventDefault();
    
    const fileInput = document.getElementById('excelFile');
    const tableType = document.getElementById('tableType').value;
    
    if (!fileInput.files[0]) {
        showAlert('Seleccione un archivo Excel', 'warning');
        return;
    }
    
    if (!tableType) {
        showAlert('Seleccione el tipo de tabla', 'warning');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('table_type', tableType);
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE}/excel/upload`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message, 'success');
            document.getElementById('excelUploadForm').reset();
            
            if (result.validation_warnings && result.validation_warnings.length > 0) {
                showAlert('Advertencias: ' + result.validation_warnings.join(', '), 'warning');
            }
        } else {
            showAlert('Error procesando archivo: ' + result.error, 'danger');
            
            if (result.validation_errors) {
                showAlert('Errores de validación: ' + result.validation_errors.join(', '), 'danger');
            }
        }
    } catch (error) {
        showAlert('Error de conexión al subir archivo', 'danger');
        console.error('Excel upload error:', error);
    } finally {
        hideLoading();
    }
}

async function downloadTemplate(tableType) {
    try {
        const response = await fetch(`${API_BASE}/excel/templates/${tableType}`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `plantilla_${tableType}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showAlert('Plantilla descargada exitosamente', 'success');
        } else {
            const error = await response.json();
            showAlert('Error descargando plantilla: ' + error.error, 'danger');
        }
    } catch (error) {
        showAlert('Error de conexión al descargar plantilla', 'danger');
        console.error('Template download error:', error);
    }
}

async function loadExcelData() {
    const tableType = document.getElementById('excelDataType').value;
    const container = document.getElementById('excelDataDisplay');
    
    if (!tableType) {
        container.innerHTML = '<p class="text-muted">Selecciona un tipo de datos para visualizar.</p>';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/excel/data/${tableType}`);
        const data = await response.json();
        
        if (response.ok) {
            displayExcelData(data.data, tableType);
        } else {
            container.innerHTML = `<p class="text-danger">Error cargando datos: ${data.error}</p>`;
        }
    } catch (error) {
        container.innerHTML = '<p class="text-danger">Error de conexión al cargar datos</p>';
        console.error('Excel data load error:', error);
    }
}

function displayExcelData(data, tableType) {
    const container = document.getElementById('excelDataDisplay');
    
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-muted">No hay datos disponibles para este tipo.</p>';
        return;
    }
    
    // Create table based on data structure
    const firstItem = data[0];
    const columns = Object.keys(firstItem).filter(key => key !== 'id' && key !== 'upload_date');
    
    const html = `
        <div class="table-responsive">
            <table class="table table-striped table-sm">
                <thead>
                    <tr>
                        ${columns.map(col => `<th>${col}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${data.slice(0, 20).map(item => `
                        <tr>
                            ${columns.map(col => `<td>${item[col] || '-'}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ${data.length > 20 ? `<p class="text-muted">Mostrando 20 de ${data.length} registros</p>` : ''}
    `;
    
    container.innerHTML = html;
}

// Reports Functions
async function loadReports() {
    // Load process trends chart
    loadProcessTrendsChart();
    
    // Load process list for analysis
    loadProcessesForAnalysis();
}

async function loadProcessTrendsChart() {
    try {
        const response = await fetch(`${API_BASE}/reports/chart/process-trends`);
        const data = await response.json();
        
        if (response.ok) {
            const ctx = document.getElementById('trendsChart');
            if (ctx && data.data) {
                if (charts.trendsChart) charts.trendsChart.destroy();
                
                charts.trendsChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: data.data.map(item => item.month),
                        datasets: [{
                            label: 'Procesos Creados',
                            data: data.data.map(item => item.count),
                            borderColor: '#0d6efd',
                            backgroundColor: 'rgba(13, 110, 253, 0.1)',
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                });
            }
        } else {
            console.error('Error loading trends chart:', data.error);
        }
    } catch (error) {
        console.error('Trends chart load error:', error);
    }
}

async function loadProcessesForAnalysis() {
    try {
        const response = await fetch(`${API_BASE}/processes?per_page=100`);
        const data = await response.json();
        
        if (response.ok) {
            const select = document.getElementById('processAnalysisSelect');
            select.innerHTML = '<option value="">Seleccionar proceso...</option>';
            
            data.processes.forEach(process => {
                const option = document.createElement('option');
                option.value = process.id;
                option.textContent = `${process.process_number} - ${process.title}`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading processes for analysis:', error);
    }
}

async function generateProcessAnalysis() {
    const processId = document.getElementById('processAnalysisSelect').value;
    const container = document.getElementById('processAnalysisResult');
    
    if (!processId) {
        showAlert('Seleccione un proceso para analizar', 'warning');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE}/reports/process/${processId}/analysis`);
        const data = await response.json();
        
        if (response.ok) {
            displayProcessAnalysis(data, container);
        } else {
            container.innerHTML = `<p class="text-danger">Error: ${data.error}</p>`;
        }
    } catch (error) {
        container.innerHTML = '<p class="text-danger">Error de conexión</p>';
        console.error('Process analysis error:', error);
    } finally {
        hideLoading();
    }
}

function displayProcessAnalysis(data, container) {
    const analysis = data.analysis;
    
    let html = `
        <div class="card">
            <div class="card-header">
                <h6>Análisis del Proceso: ${data.process.process_number}</h6>
            </div>
            <div class="card-body">
    `;
    
    if (analysis.message) {
        html += `<p class="text-muted">${analysis.message}</p>`;
    } else {
        html += `<p><strong>Total de ofertas:</strong> ${analysis.total_bids}</p>`;
        
        if (analysis.financial_analysis && Object.keys(analysis.financial_analysis).length > 0) {
            html += `
                <h6>Análisis Financiero</h6>
                <ul>
                    <li>Promedio: ${formatCurrency(analysis.financial_analysis.average_amount)}</li>
                    <li>Oferta más baja: ${formatCurrency(analysis.financial_analysis.lowest_bid)}</li>
                    <li>Oferta más alta: ${formatCurrency(analysis.financial_analysis.highest_bid)}</li>
                    ${analysis.financial_analysis.savings_vs_budget ? 
                        `<li>Ahorro vs presupuesto: ${formatCurrency(analysis.financial_analysis.savings_vs_budget)} (${analysis.financial_analysis.savings_percentage.toFixed(1)}%)</li>` 
                        : ''}
                </ul>
            `;
        }
        
        if (analysis.technical_analysis && Object.keys(analysis.technical_analysis).length > 0) {
            html += `
                <h6>Análisis Técnico</h6>
                <ul>
                    <li>Puntuación promedio: ${analysis.technical_analysis.average_score.toFixed(2)}</li>
                    <li>Puntuación más alta: ${analysis.technical_analysis.highest_score}</li>
                    <li>Puntuación más baja: ${analysis.technical_analysis.lowest_score}</li>
                </ul>
            `;
        }
    }
    
    html += `
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// Pagination Functions
function updatePagination(section, currentPage, totalPages) {
    const container = document.getElementById(`${section}Pagination`);
    if (!container || totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<ul class="pagination justify-content-center">';
    
    // Previous button
    html += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="load${section.charAt(0).toUpperCase() + section.slice(1)}(${currentPage - 1})">
                Anterior
            </a>
        </li>
    `;
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        html += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="load${section.charAt(0).toUpperCase() + section.slice(1)}(${i})">
                    ${i}
                </a>
            </li>
        `;
    }
    
    // Next button
    html += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="load${section.charAt(0).toUpperCase() + section.slice(1)}(${currentPage + 1})">
                Siguiente
            </a>
        </li>
    `;
    
    html += '</ul>';
    container.innerHTML = html;
}

