const API_BASE = "http://127.0.0.1:8000/api/gl";
const GST_API_BASE = "http://127.0.0.1:8000/api/gst";
const HEALTH_URL = "http://127.0.0.1:8000/api/health";

let accounts = [];
let journals = [];
let ledgerItems = [];
let gstTransactions = [];

function showMessage(message, isError = false) {
    const element = document.getElementById("message");
    if (!element) return;

    element.textContent = message;
    element.classList.remove("hidden", "error");

    if (isError) {
        element.classList.add("error");
    }

    setTimeout(() => element.classList.add("hidden"), 4500);
}

async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });

        const text = await response.text();
        let data = null;

        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = text;
        }

        if (!response.ok) {
            const detail = data && typeof data === "object"
                ? data.detail
                : data;

            const message = Array.isArray(detail)
                ? detail.map(item => item.msg || JSON.stringify(item)).join("; ")
                : (detail || `Request failed (${response.status})`);

            throw new Error(message);
        }

        return data;
    } catch (err) {
        console.warn(`API call failed for ${url}:`, err.message);
        throw err;
    }
}

/* =========================
   NAVIGATION (DASHBOARD / GENERAL LEDGER / GST)
========================= */
function showSection(sectionId) {
    console.log("Navigating to section:", sectionId);

    // 1. Synchronously toggle visibility
    document.querySelectorAll(".section").forEach(sec => {
        if (sec.id === sectionId) {
            sec.classList.remove("hidden");
            sec.style.display = "block";
        } else {
            sec.classList.add("hidden");
            sec.style.display = "none";
        }
    });

    // 2. Synchronously update active navigation button
    document.querySelectorAll(".nav-btn").forEach(btn => {
        if (btn.dataset.section === sectionId) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    // 3. Update topbar title
    const title = document.getElementById("pageTitle");
    const subtitle = document.getElementById("pageSubtitle");
    if (title) {
        if (sectionId === "dashboard") {
            title.textContent = "Dashboard Overview";
            if (subtitle) subtitle.textContent = "Enterprise Finance · General Ledger & GST Portal · Company Code 1000";
        } else if (sectionId === "ledger") {
            title.textContent = "General Ledger";
            if (subtitle) subtitle.textContent = "Ledger Statements, Account Postings & Double-Entry Journals";
        } else if (sectionId === "gst") {
            title.textContent = "Goods and Services Tax (GST)";
            if (subtitle) subtitle.textContent = "GST Invoicing, Inward/Outward Tax & Input Tax Credit (ITC)";
        }
    }

    window.scrollTo({ top: 0, behavior: "smooth" });

    // 4. Safely load section-specific data in background
    if (sectionId === "ledger") {
        loadAccounts().catch(() => {});
        loadJournals().catch(() => {});
        loadLedgerReport().catch(() => {});
    } else if (sectionId === "gst") {
        loadGstData().catch(() => {});
    } else if (sectionId === "dashboard") {
        loadDashboardMetrics().catch(() => {});
    }
}

// Bind navigation clicks
document.querySelectorAll(".nav-btn").forEach(button => {
    button.addEventListener("click", () => {
        showSection(button.dataset.section);
    });
});

/* =========================
   GENERAL LEDGER SUB-TABS
========================= */
function switchGlTab(tabId) {
    document.querySelectorAll(".tab-content").forEach(tab => {
        if (tab.id === tabId) {
            tab.classList.remove("hidden");
            tab.style.display = "block";
        } else {
            tab.classList.add("hidden");
            tab.style.display = "none";
        }
    });

    const tabMap = {
        ledgerBook: "tabBtnLedgerBook",
        accountsTab: "tabBtnAccounts",
        journalsTab: "tabBtnJournals"
    };

    Object.entries(tabMap).forEach(([contentId, btnId]) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            if (contentId === tabId) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        }
    });

    if (tabId === "ledgerBook") {
        loadLedgerReport().catch(() => {});
    } else if (tabId === "accountsTab") {
        loadAccounts().catch(() => {});
    } else if (tabId === "journalsTab") {
        loadJournals().catch(() => {});
    }
}

/* =========================
   BACKEND HEALTH CHECK
========================= */
async function checkBackend() {
    const status = document.getElementById("connectionStatus");
    if (!status) return;

    try {
        await apiRequest(HEALTH_URL);
        status.textContent = "● Backend Connected";
        status.style.background = "#e0f6e8";
        status.style.color = "#187343";
    } catch (error) {
        status.textContent = "● Backend Offline";
        status.style.background = "#ffe6e6";
        status.style.color = "#a82020";
    }
}

/* =========================
   DASHBOARD REFRESH & METRICS
========================= */
async function loadDashboardMetrics() {
    await Promise.allSettled([
        loadAccounts(),
        loadJournals(),
        loadLedgerReport(),
        loadGstSummary(),
        loadGstTransactions()
    ]);
    updateDashboardCards();
}

function updateDashboardCards() {
    // 1. General Ledger Metrics
    const postingsCountElem = document.getElementById("dashGlPostings");
    if (postingsCountElem) postingsCountElem.textContent = ledgerItems.length;

    const glAccountsSummary = document.getElementById("glAccountsSummary");
    if (glAccountsSummary) glAccountsSummary.textContent = accounts.length;

    const glJournalsSummary = document.getElementById("glJournalsSummary");
    if (glJournalsSummary) glJournalsSummary.textContent = journals.length;

    let totalDebit = 0;
    let totalCredit = 0;
    ledgerItems.forEach(item => {
        totalDebit += Number(item.debit || 0);
        totalCredit += Number(item.credit || 0);
    });
    const netBalance = totalDebit - totalCredit;
    const formattedBalance = (netBalance >= 0 ? "₹" : "-₹") + Math.abs(netBalance).toFixed(2);

    const dashGlBalance = document.getElementById("dashGlBalance");
    if (dashGlBalance) {
        dashGlBalance.textContent = formattedBalance;
    }

    const glBalanceSummary = document.getElementById("glBalanceSummary");
    if (glBalanceSummary) {
        glBalanceSummary.textContent = formattedBalance;
    }
}

/* =========================
   CHART OF ACCOUNTS
========================= */
function resetAccountForm() {
    const form = document.getElementById("accountForm");
    if (form) form.reset();

    const accId = document.getElementById("accountId");
    if (accId) accId.value = "";

    const comp = document.getElementById("companyCode");
    if (comp) {
        comp.value = "1000";
        comp.disabled = false;
    }

    const code = document.getElementById("accountCode");
    if (code) code.disabled = false;

    const title = document.getElementById("accountFormTitle");
    if (title) title.textContent = "Create GL Account";

    const saveBtn = document.getElementById("saveAccountBtn");
    if (saveBtn) saveBtn.textContent = "Save Account";
}

document.getElementById("accountForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const id = document.getElementById("accountId").value;
    const payload = {
        company_code: document.getElementById("companyCode").value.trim(),
        account_code: document.getElementById("accountCode").value.trim(),
        account_name: document.getElementById("accountName").value.trim(),
        account_type: document.getElementById("accountType").value,
        account_group: document.getElementById("accountGroup").value.trim()
    };

    try {
        if (id) {
            await apiRequest(`${API_BASE}/accounts/${id}`, {
                method: "PUT",
                body: JSON.stringify({
                    account_name: payload.account_name,
                    account_type: payload.account_type,
                    account_group: payload.account_group
                })
            });
            showMessage("Account updated successfully.");
        } else {
            await apiRequest(`${API_BASE}/accounts`, {
                method: "POST",
                body: JSON.stringify(payload)
            });
            showMessage("Account created and saved to database.");
        }

        resetAccountForm();
        await loadAccounts();
        await loadLedgerReport();
        updateDashboardCards();
    } catch (error) {
        showMessage(error.message, true);
    }
});

async function loadAccounts() {
    const tbody = document.getElementById("accountTableBody");
    const filterSelect = document.getElementById("ledgerAccountFilter");

    try {
        const data = await apiRequest(`${API_BASE}/accounts`);
        accounts = Array.isArray(data) ? data : [];

        if (filterSelect) {
            const currentFilter = filterSelect.value;
            filterSelect.innerHTML = '<option value="">All Accounts</option>';
            accounts.forEach(account => {
                const opt = document.createElement("option");
                opt.value = account.id;
                opt.textContent = `${account.account_code} - ${account.account_name} (${account.account_type})`;
                filterSelect.appendChild(opt);
            });
            filterSelect.value = currentFilter;
        }

        if (tbody) {
            if (accounts.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7">No accounts found. Create your first GL account above.</td></tr>';
                renderJournalLines();
                return;
            }

            tbody.innerHTML = accounts.map(account => `
                <tr>
                    <td>${account.id}</td>
                    <td><strong>${escapeHtml(account.account_code)}</strong></td>
                    <td>${escapeHtml(account.account_name)}</td>
                    <td>${escapeHtml(account.account_type)}</td>
                    <td>${escapeHtml(account.account_group)}</td>
                    <td>
                        <span class="badge ${account.is_active ? "" : "inactive"}">
                            ${account.is_active ? "Active" : "Inactive"}
                        </span>
                    </td>
                    <td>
                        <div class="row-actions">
                            <button class="secondary" onclick="editAccount(${account.id})">Edit</button>
                            <button class="danger" onclick="deleteAccount(${account.id})">Delete</button>
                        </div>
                    </td>
                </tr>
            `).join("");
        }

        renderJournalLines();
        updateDashboardCards();
    } catch (error) {
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7">Could not load accounts. Check backend connection.</td></tr>';
        }
    }
}

function editAccount(id) {
    const account = accounts.find(item => item.id === id);
    if (!account) return;

    document.getElementById("accountId").value = account.id;
    document.getElementById("companyCode").value = account.company_code;
    document.getElementById("accountCode").value = account.account_code;
    document.getElementById("accountCode").disabled = true;
    document.getElementById("companyCode").disabled = true;
    document.getElementById("accountName").value = account.account_name;
    document.getElementById("accountType").value = account.account_type;
    document.getElementById("accountGroup").value = account.account_group;
    document.getElementById("accountFormTitle").textContent = "Edit Account";
    document.getElementById("saveAccountBtn").textContent = "Update Account";

    switchGlTab("accountsTab");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteAccount(id) {
    const account = accounts.find(item => item.id === id);
    if (!account) return;

    if (!confirm(`Delete account ${account.account_code} - ${account.account_name}?`)) {
        return;
    }

    try {
        await apiRequest(`${API_BASE}/accounts/${id}`, { method: "DELETE" });
        showMessage("Account deleted successfully.");
        await loadAccounts();
        await loadLedgerReport();
        updateDashboardCards();
    } catch (error) {
        showMessage(error.message, true);
    }
}

/* =========================
   JOURNAL ENTRIES
========================= */
function addJournalLine() {
    const container = document.getElementById("journalLines");
    if (!container) return;

    const row = document.createElement("div");
    row.className = "journal-line";

    row.innerHTML = `
        <select class="line-account" required aria-label="Account">
            <option value="">Select account</option>
        </select>
        <input class="line-debit" type="number" min="0" step="0.01" value="0" placeholder="Debit" required>
        <input class="line-credit" type="number" min="0" step="0.01" value="0" placeholder="Credit" required>
        <button type="button" class="danger" aria-label="Remove line">Remove</button>
    `;

    row.querySelector(".danger").addEventListener("click", () => {
        row.remove();
        updateTotals();
    });

    row.querySelector(".line-debit").addEventListener("input", updateTotals);
    row.querySelector(".line-credit").addEventListener("input", updateTotals);

    container.appendChild(row);
    renderJournalLines();
    updateTotals();
}

function renderJournalLines() {
    document.querySelectorAll(".line-account").forEach(select => {
        const previousValue = select.value;
        select.innerHTML = '<option value="">Select account</option>';

        accounts
            .filter(account => account.is_active)
            .forEach(account => {
                const option = document.createElement("option");
                option.value = account.id;
                option.textContent = `${account.account_code} - ${account.account_name}`;
                select.appendChild(option);
            });

        if (accounts.some(account => String(account.id) === previousValue && account.is_active)) {
            select.value = previousValue;
        }
    });
}

function updateTotals() {
    let debit = 0;
    let credit = 0;

    document.querySelectorAll(".journal-line").forEach(row => {
        debit += Number(row.querySelector(".line-debit")?.value || 0);
        credit += Number(row.querySelector(".line-credit")?.value || 0);
    });

    const debitElem = document.getElementById("totalDebit");
    const creditElem = document.getElementById("totalCredit");
    if (debitElem) debitElem.textContent = debit.toFixed(2);
    if (creditElem) creditElem.textContent = credit.toFixed(2);
}

document.getElementById("journalForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const rows = [...document.querySelectorAll(".journal-line")];
    const lines = rows.map(row => ({
        account_id: Number(row.querySelector(".line-account").value),
        debit: Number(row.querySelector(".line-debit").value || 0),
        credit: Number(row.querySelector(".line-credit").value || 0)
    }));

    if (lines.length < 2) {
        showMessage("At least two journal lines are required.", true);
        return;
    }

    const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.000001) {
        showMessage("Total debit must equal total credit.", true);
        return;
    }

    const payload = {
        company_code: document.getElementById("journalCompany").value.trim(),
        posting_date: document.getElementById("postingDate").value,
        narration: document.getElementById("narration").value.trim(),
        lines
    };

    try {
        const result = await apiRequest(`${API_BASE}/journal-entries`, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        showMessage(`Journal posted successfully. Document: ${result.document_number}`);

        document.getElementById("journalForm").reset();
        document.getElementById("journalCompany").value = "1000";
        document.getElementById("postingDate").value = new Date().toLocaleDateString("en-CA");
        document.getElementById("journalLines").innerHTML = "";
        addJournalLine();
        addJournalLine();

        await loadJournals();
        await loadLedgerReport();
        updateDashboardCards();
    } catch (error) {
        showMessage(error.message, true);
    }
});

async function loadJournals() {
    const container = document.getElementById("journalList");
    if (!container) return;

    try {
        const entries = await apiRequest(`${API_BASE}/journal-entries`);
        journals = Array.isArray(entries) ? entries : [];

        if (journals.length === 0) {
            container.textContent = "No journal entries posted yet.";
            return;
        }

        container.innerHTML = journals.map(entry => `
            <div class="journal-card">
                <h4>${escapeHtml(entry.document_number)} — ${escapeHtml(entry.status)}</h4>
                <p>
                    Posting Date: ${escapeHtml(entry.posting_date)}
                    | Company: ${escapeHtml(entry.company_code)}
                </p>
                <p><strong>Narration:</strong> ${escapeHtml(entry.narration)}</p>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Account</th>
                                <th>Debit (₹)</th>
                                <th>Credit (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${entry.lines.map(line => `
                                <tr>
                                    <td>${escapeHtml(line.account_code)} - ${escapeHtml(line.account_name)}</td>
                                    <td>${Number(line.debit).toFixed(2)}</td>
                                    <td>${Number(line.credit).toFixed(2)}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        `).join("");

        updateDashboardCards();
    } catch (error) {
        container.textContent = "Could not load journal entries.";
    }
}

/* =========================
   GENERAL LEDGER REPORT / BOOK
========================= */
async function loadLedgerReport() {
    const tbody = document.getElementById("ledgerTableBody");
    const accountFilter = document.getElementById("ledgerAccountFilter")?.value || "";

    try {
        const url = accountFilter
            ? `${API_BASE}/ledger-report?account_id=${accountFilter}`
            : `${API_BASE}/ledger-report`;

        const report = await apiRequest(url);
        ledgerItems = (report && Array.isArray(report.items)) ? report.items : [];

        let totalDebit = 0;
        let totalCredit = 0;

        if (tbody) {
            if (ledgerItems.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7">No ledger postings found for the selected criteria.</td></tr>';
                document.getElementById("ledgerTotalDebit").textContent = "0.00";
                document.getElementById("ledgerTotalCredit").textContent = "0.00";
                document.getElementById("ledgerNetBalance").textContent = "0.00";
                updateDashboardCards();
                return;
            }

            tbody.innerHTML = ledgerItems.map(item => {
                const debitNum = Number(item.debit || 0);
                const creditNum = Number(item.credit || 0);
                totalDebit += debitNum;
                totalCredit += creditNum;

                return `
                    <tr>
                        <td>${escapeHtml(item.posting_date)}</td>
                        <td><strong>${escapeHtml(item.document_number)}</strong></td>
                        <td>${escapeHtml(item.account_code)} - ${escapeHtml(item.account_name)}</td>
                        <td>${escapeHtml(item.narration)}</td>
                        <td>${debitNum > 0 ? "₹" + debitNum.toFixed(2) : "-"}</td>
                        <td>${creditNum > 0 ? "₹" + creditNum.toFixed(2) : "-"}</td>
                        <td><strong>₹${Number(item.running_balance || 0).toFixed(2)}</strong></td>
                    </tr>
                `;
            }).join("");

            document.getElementById("ledgerTotalDebit").textContent = totalDebit.toFixed(2);
            document.getElementById("ledgerTotalCredit").textContent = totalCredit.toFixed(2);
            const net = totalDebit - totalCredit;
            document.getElementById("ledgerNetBalance").textContent = `${net >= 0 ? "+" : ""}${net.toFixed(2)}`;
        }

        updateDashboardCards();
    } catch (error) {
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7">Could not load general ledger statement. Check backend connection.</td></tr>';
        }
    }
}

/* =========================
   GST MODULE
========================= */
function calculateGstPreview() {
    const taxableInput = document.getElementById("gstTaxable");
    const rateInput = document.getElementById("gstRate");
    const supplyTypeInput = document.getElementById("gstSupplyType");

    if (!taxableInput || !rateInput || !supplyTypeInput) return;

    const taxable = Math.max(0, Number(taxableInput.value || 0));
    const rate = Number(rateInput.value || 0);
    const supplyType = supplyTypeInput.value;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    const totalTaxRate = rate / 100;

    if (supplyType === "INTRA_STATE") {
        const halfRate = totalTaxRate / 2;
        cgst = taxable * halfRate;
        sgst = taxable * halfRate;
        igst = 0;
    } else {
        cgst = 0;
        sgst = 0;
        igst = taxable * totalTaxRate;
    }

    const total = taxable + cgst + sgst + igst;

    const pCgst = document.getElementById("previewCgst");
    const pSgst = document.getElementById("previewSgst");
    const pIgst = document.getElementById("previewIgst");
    const pTotal = document.getElementById("previewTotal");

    if (pCgst) pCgst.textContent = cgst.toFixed(2);
    if (pSgst) pSgst.textContent = sgst.toFixed(2);
    if (pIgst) pIgst.textContent = igst.toFixed(2);
    if (pTotal) pTotal.textContent = total.toFixed(2);
}

function resetGstForm() {
    const form = document.getElementById("gstForm");
    if (form) form.reset();

    const comp = document.getElementById("gstCompany");
    if (comp) comp.value = "1000";

    const date = document.getElementById("gstDate");
    if (date) date.value = new Date().toLocaleDateString("en-CA");

    const tax = document.getElementById("gstTaxable");
    if (tax) tax.value = "10000.00";

    const rate = document.getElementById("gstRate");
    if (rate) rate.value = "18";

    const supply = document.getElementById("gstSupplyType");
    if (supply) supply.value = "INTRA_STATE";

    calculateGstPreview();
}

document.getElementById("gstForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const taxable = Number(document.getElementById("gstTaxable").value || 0);
    const rate = Number(document.getElementById("gstRate").value || 0);
    const supplyType = document.getElementById("gstSupplyType").value;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (supplyType === "INTRA_STATE") {
        cgst = taxable * (rate / 200);
        sgst = taxable * (rate / 200);
    } else {
        igst = taxable * (rate / 100);
    }

    const payload = {
        company_code: document.getElementById("gstCompany").value.trim(),
        invoice_number: document.getElementById("gstInvoiceNo").value.trim(),
        invoice_date: document.getElementById("gstDate").value,
        party_name: document.getElementById("gstParty").value.trim(),
        gstin: document.getElementById("gstin").value.trim().toUpperCase(),
        transaction_type: document.getElementById("gstType").value,
        supply_type: supplyType,
        hsn_sac: document.getElementById("gstHsn").value.trim() || null,
        taxable_amount: taxable,
        gst_rate: rate,
        cgst_amount: Number(cgst.toFixed(2)),
        sgst_amount: Number(sgst.toFixed(2)),
        igst_amount: Number(igst.toFixed(2)),
        total_amount: Number((taxable + cgst + sgst + igst).toFixed(2))
    };

    try {
        await apiRequest(`${GST_API_BASE}/transactions`, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        showMessage(`GST invoice ${payload.invoice_number} saved successfully.`);
        resetGstForm();
        await loadGstData();
        updateDashboardCards();
    } catch (error) {
        showMessage(error.message, true);
    }
});

async function loadGstData() {
    await Promise.allSettled([loadGstSummary(), loadGstTransactions()]);
}

async function loadGstSummary() {
    try {
        const summary = await apiRequest(`${GST_API_BASE}/summary`);
        if (!summary) return;

        const outwardTaxable = Number(summary.total_outward_taxable || 0);
        const inwardTaxable = Number(summary.total_inward_taxable || 0);
        const outputTax = Number(summary.total_output_tax || 0);
        const itc = Number(summary.total_input_tax_credit || 0);
        const netPayable = Number(summary.net_gst_payable || 0);
        const totalTurnover = outwardTaxable + inwardTaxable;

        // GST Section Cards
        const elOutward = document.getElementById("gstOutwardTaxable");
        if (elOutward) elOutward.textContent = "₹" + outwardTaxable.toFixed(2);

        const elOutput = document.getElementById("gstOutputTax");
        if (elOutput) elOutput.textContent = "₹" + outputTax.toFixed(2);

        const elItc = document.getElementById("gstItc");
        if (elItc) elItc.textContent = "₹" + itc.toFixed(2);

        const elNet = document.getElementById("gstNetPayable");
        if (elNet) {
            elNet.textContent = (netPayable >= 0 ? "₹" : "-₹") + Math.abs(netPayable).toFixed(2);
            elNet.style.color = netPayable > 0 ? "#b91c1c" : "#15803d";
        }

        // Dashboard GST Cards
        const elDashNet = document.getElementById("netGstLiability");
        if (elDashNet) {
            elDashNet.textContent = (netPayable >= 0 ? "₹" : "-₹") + Math.abs(netPayable).toFixed(2);
            elDashNet.style.color = netPayable > 0 ? "#b91c1c" : "#15803d";
        }

        const elDashCount = document.getElementById("gstCount");
        if (elDashCount) {
            elDashCount.textContent = summary.total_transactions || 0;
        }

        const elDashTurnover = document.getElementById("dashGstTurnover");
        if (elDashTurnover) {
            elDashTurnover.textContent = "₹" + totalTurnover.toFixed(2);
        }

        const elDashOutput = document.getElementById("dashOutputGst");
        if (elDashOutput) {
            elDashOutput.textContent = "₹" + outputTax.toFixed(2);
        }

        const elDashItc = document.getElementById("dashItcGst");
        if (elDashItc) {
            elDashItc.textContent = "₹" + itc.toFixed(2);
        }
    } catch (error) {
        // Backend offline or not ready
    }
}

async function loadGstTransactions() {
    const tbody = document.getElementById("gstTableBody");
    const filter = document.getElementById("gstFilterType")?.value || "";

    try {
        const url = filter
            ? `${GST_API_BASE}/transactions?transaction_type=${filter}`
            : `${GST_API_BASE}/transactions`;

        const data = await apiRequest(url);
        gstTransactions = Array.isArray(data) ? data : [];

        if (tbody) {
            if (gstTransactions.length === 0) {
                tbody.innerHTML = '<tr><td colspan="12">No GST transactions found. Record your first invoice above.</td></tr>';
                renderRateSummary([]);
                return;
            }

            tbody.innerHTML = gstTransactions.map(tx => `
                <tr>
                    <td><strong>${escapeHtml(tx.invoice_number)}</strong></td>
                    <td>${escapeHtml(tx.invoice_date)}</td>
                    <td>${escapeHtml(tx.party_name)}</td>
                    <td><code>${escapeHtml(tx.gstin)}</code></td>
                    <td>
                        <span class="${tx.transaction_type === 'OUTWARD' ? 'pill-sale' : 'pill-purchase'}">
                            ${tx.transaction_type === 'OUTWARD' ? 'Sales (Output)' : 'Purchase (ITC)'}
                        </span>
                    </td>
                    <td>
                        <span class="${tx.supply_type === 'INTRA_STATE' ? 'pill-intrastate' : 'pill-interstate'}">
                            ${tx.supply_type === 'INTRA_STATE' ? 'Intra-State' : 'Inter-State'}
                        </span>
                    </td>
                    <td>₹${Number(tx.taxable_amount).toFixed(2)}</td>
                    <td>₹${Number(tx.cgst_amount).toFixed(2)}</td>
                    <td>₹${Number(tx.sgst_amount).toFixed(2)}</td>
                    <td>₹${Number(tx.igst_amount).toFixed(2)}</td>
                    <td><strong>₹${Number(tx.total_amount).toFixed(2)}</strong></td>
                    <td>
                        <div class="row-actions">
                            <button class="danger" onclick="deleteGstTransaction(${tx.id})">Delete</button>
                        </div>
                    </td>
                </tr>
            `).join("");
        }

        renderRateSummary(gstTransactions);
    } catch (error) {
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="12">Could not load GST transactions. Check backend connection.</td></tr>';
        }
    }
}

function renderRateSummary(transactions) {
    const tbody = document.getElementById("gstRateTableBody");
    if (!tbody) return;

    const rates = [0, 5, 12, 18, 28];
    const rateMap = {};

    rates.forEach(r => {
        rateMap[r] = {
            outwardTaxable: 0,
            outputTax: 0,
            inwardTaxable: 0,
            itc: 0
        };
    });

    if (Array.isArray(transactions)) {
        transactions.forEach(tx => {
            const r = Number(tx.gst_rate);
            if (!rateMap[r]) {
                rateMap[r] = { outwardTaxable: 0, outputTax: 0, inwardTaxable: 0, itc: 0 };
            }

            const taxable = Number(tx.taxable_amount || 0);
            const tax = Number(tx.cgst_amount || 0) + Number(tx.sgst_amount || 0) + Number(tx.igst_amount || 0);

            if (tx.transaction_type === "OUTWARD") {
                rateMap[r].outwardTaxable += taxable;
                rateMap[r].outputTax += tax;
            } else {
                rateMap[r].inwardTaxable += taxable;
                rateMap[r].itc += tax;
            }
        });
    }

    tbody.innerHTML = rates.map(r => {
        const data = rateMap[r];
        const net = data.outputTax - data.itc;
        return `
            <tr>
                <td><strong>${r}%</strong></td>
                <td>₹${data.outwardTaxable.toFixed(2)}</td>
                <td>₹${data.outputTax.toFixed(2)}</td>
                <td>₹${data.inwardTaxable.toFixed(2)}</td>
                <td>₹${data.itc.toFixed(2)}</td>
                <td><strong>${(net >= 0 ? "₹" : "-₹") + Math.abs(net).toFixed(2)}</strong></td>
            </tr>
        `;
    }).join("");
}

async function deleteGstTransaction(id) {
    if (!confirm("Are you sure you want to delete this GST transaction?")) return;

    try {
        await apiRequest(`${GST_API_BASE}/transactions/${id}`, { method: "DELETE" });
        showMessage("GST transaction deleted successfully.");
        await loadGstData();
        updateDashboardCards();
    } catch (error) {
        showMessage(error.message, true);
    }
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

// Initial initialization
try {
    const postDate = document.getElementById("postingDate");
    if (postDate) postDate.value = new Date().toLocaleDateString("en-CA");

    const gDate = document.getElementById("gstDate");
    if (gDate) gDate.value = new Date().toLocaleDateString("en-CA");

    addJournalLine();
    addJournalLine();
    calculateGstPreview();
    checkBackend();
    loadDashboardMetrics();
} catch (initErr) {
    console.error("Initialization error:", initErr);
}

window.showSection = showSection;
window.switchGlTab = switchGlTab;

