/**
 * KostCalc - Smart Expense Tracker for Boarding Students
 * Single Page Application Logic
 */

// ================= DATA STATE =================
const STORAGE_KEY = "KOSTCALC_DATA_V1";

let appState = {
  initialBalance: 0,
  transactions: [],
  piggyTransfers: [],
  budgets: {
    weekly: 0,
    monthly: 0,
    categories: {
      "Makan & Minum": 0,
      Transportasi: 0,
      Kuliah: 0,
      Laundry: 0,
      Hiburan: 0,
      "Lainnya (Pengeluaran)": 0,
    },
  },
  targets: [],
};

// ================= KATEGORI CONSTANTS =================
const EXPENSE_CATEGORIES = [
  "Makan & Minum",
  "Transportasi",
  "Kuliah",
  "Laundry",
  "Hiburan",
  "Lainnya (Pengeluaran)",
];

const INCOME_CATEGORIES = [
  "Uang Saku",
  "Beasiswa",
  "Part-Time",
  "Lainnya (Pemasukan)",
];

// ================= INITIALIZATION =================
document.addEventListener("DOMContentLoaded", () => {
  loadLocalStorage();
  setupEventListeners();
  updateAllViews();

  // Set default date modal input to today
  document.getElementById("txDate").valueAsDate = new Date();
});

// Load Data from LocalStorage
function loadLocalStorage() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      appState = { ...appState, ...parsed };
    } catch (e) {
      console.error("Gagal parsing data LocalStorage:", e);
    }
  }
}

// Save Data to LocalStorage
function saveLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  updateAllViews();
}

// ================= EVENT LISTENERS SETUP =================
function setupEventListeners() {
  // Tab Navigation
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const targetTab = e.currentTarget.getAttribute("data-tab");
      switchTab(targetTab);
    });
  });

  // Form Initial Balance
  document
    .getElementById("btnInitialBalance")
    .addEventListener("click", openInitialBalanceModal);
  document
    .getElementById("formInitialBalance")
    .addEventListener("submit", (e) => {
      e.preventDefault();
      const val =
        parseFloat(document.getElementById("initialBalanceInput").value) || 0;
      appState.initialBalance = val;
      saveLocalStorage();
      closeInitialBalanceModal();
      showToast("Saldo awal berhasil diperbarui!");
    });

  // Form Transaksi
  document
    .getElementById("formTransaction")
    .addEventListener("submit", handleSaveTransaction);

  // Filter Transaksi
  document
    .getElementById("txSearchInput")
    .addEventListener("input", renderTransactionsTable);
  document
    .getElementById("txCategoryFilter")
    .addEventListener("change", renderTransactionsTable);
  document
    .getElementById("txPeriodFilter")
    .addEventListener("change", renderTransactionsTable);

  // Form Anggaran
  document
    .getElementById("formBudgetSettings")
    .addEventListener("submit", handleSaveBudgets);

  // Form Celengan (Setor & Tarik)
  document
    .getElementById("formPiggyDeposit")
    .addEventListener("submit", handlePiggyDeposit);
  document
    .getElementById("formPiggyWithdraw")
    .addEventListener("submit", handlePiggyWithdraw);

  // Form Target Tabungan
  document
    .getElementById("formCreateTarget")
    .addEventListener("submit", handleCreateTarget);
  document
    .getElementById("formUpdateTarget")
    .addEventListener("submit", handleUpdateTargetProgress);

  // Report Period
  document
    .getElementById("reportPeriodSelect")
    .addEventListener("change", renderReportTable);
}

// Switch Active Navigation Tab
function switchTab(tabId) {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId);
  });
  document.querySelectorAll(".tab-content").forEach((section) => {
    section.classList.toggle("active", section.id === `tab-${tabId}`);
  });
}

// ================= PERHITUNGAN KEUANGAN (FINANCIAL RULES) =================
/**
 * Saldo Utama = Saldo awal + pemasukan - pengeluaran - setoran celengan + penarikan celengan
 */
function calculateMainBalance() {
  const totalIncome = appState.transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = appState.transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalPiggyDeposits = appState.piggyTransfers
    .filter((p) => p.type === "deposit")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPiggyWithdrawals = appState.piggyTransfers
    .filter((p) => p.type === "withdraw")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    appState.initialBalance +
    totalIncome -
    totalExpense -
    totalPiggyDeposits +
    totalPiggyWithdrawals
  );
}

/**
 * Saldo Celengan = Total setoran celengan - total penarikan celengan
 */
function calculatePiggyBalance() {
  const totalDeposits = appState.piggyTransfers
    .filter((p) => p.type === "deposit")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalWithdrawals = appState.piggyTransfers
    .filter((p) => p.type === "withdraw")
    .reduce((sum, p) => sum + p.amount, 0);

  return totalDeposits - totalWithdrawals;
}

/**
 * Total Aset = Saldo utama + saldo celengan
 */
function calculateTotalAssets() {
  return calculateMainBalance() + calculatePiggyBalance();
}

// ================= HELPER TANGGAL & PERIODE =================
function isDateInToday(dateStr) {
  const t = new Date(dateStr);
  const today = new Date();
  return t.toDateString() === today.toDateString();
}

function isDateInCurrentWeek(dateStr) {
  const t = new Date(dateStr);
  const now = new Date();

  // Get Monday of current week
  const day = now.getDay();
  const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diffToMonday));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return t >= monday && t <= sunday;
}

function isDateInCurrentMonth(dateStr) {
  const t = new Date(dateStr);
  const now = new Date();
  return (
    t.getMonth() === now.getMonth() && t.getFullYear() === now.getFullYear()
  );
}

// Filter Helper
function filterTransactionsByPeriod(transactions, period) {
  return transactions.filter((t) => {
    if (period === "TODAY") return isDateInToday(t.date);
    if (period === "WEEK") return isDateInCurrentWeek(t.date);
    if (period === "MONTH") return isDateInCurrentMonth(t.date);
    return true; // 'ALL'
  });
}

// Format Currency Utility
function formatRp(amount) {
  return "Rp " + Number(amount || 0).toLocaleString("id-ID");
}

// Format Date Utility
function formatDateIndo(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ================= RENDER & UPDATE VIEWS =================
function updateAllViews() {
  renderDashboard();
  renderTransactionsTable();
  renderBudgets();
  renderPiggyBank();
  renderTargets();
  renderReportTable();
  populateBudgetInputDefaults();
}

// 1. DASHBOARD RENDER
function renderDashboard() {
  const mainBal = calculateMainBalance();
  const piggyBal = calculatePiggyBalance();
  const totalAssets = calculateTotalAssets();

  document.getElementById("dashMainBalance").textContent = formatRp(mainBal);
  document.getElementById("dashPiggyBalance").textContent = formatRp(piggyBal);
  document.getElementById("dashTotalAssets").textContent =
    formatRp(totalAssets);

  // Income and Expense for current month
  const monthTx = filterTransactionsByPeriod(appState.transactions, "MONTH");
  const monthIncome = monthTx
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTx
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  document.getElementById("dashTotalIncome").textContent =
    formatRp(monthIncome);
  document.getElementById("dashTotalExpense").textContent =
    formatRp(monthExpense);

  // Recent Transactions (top 5)
  const recentTx = [...appState.transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const recentBody = document.getElementById("dashRecentTransactions");
  recentBody.innerHTML = "";
  if (recentTx.length === 0) {
    recentBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Belum ada transaksi</td></tr>`;
  } else {
    recentTx.forEach((t) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td>${formatDateIndo(t.date)}</td>
                <td><span class="badge ${t.type === "income" ? "badge-success" : "badge-danger"}">${t.type === "income" ? "Pemasukan" : "Pengeluaran"}</span></td>
                <td>${t.category}</td>
                <td>${t.note || "-"}</td>
                <td class="${t.type === "income" ? "text-success" : "text-danger"} font-bold">
                    ${t.type === "income" ? "+" : "-"} ${formatRp(t.amount)}
                </td>
            `;
      recentBody.appendChild(tr);
    });
  }

  // Dashboard Quick Budget Widget
  renderDashBudgetWidget();
  // Dashboard Quick Targets Widget
  renderDashTargetsWidget();
}

function renderDashBudgetWidget() {
  const container = document.getElementById("dashBudgetWidget");
  container.innerHTML = "";

  // Weekly Calc
  const weekExpenses = filterTransactionsByPeriod(appState.transactions, "WEEK")
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  // Monthly Calc
  const monthExpenses = filterTransactionsByPeriod(
    appState.transactions,
    "MONTH",
  )
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  let html = "";

  if (appState.budgets.weekly > 0) {
    const pct = Math.round((weekExpenses / appState.budgets.weekly) * 100);
    let statusClass = "";
    let alertBadge = "";

    if (pct >= 100) {
      statusClass = "danger";
      alertBadge = `<span class="badge badge-danger">Melewati Batas (100%+)</span>`;
    } else if (pct >= 80) {
      statusClass = "warning";
      alertBadge = `<span class="badge badge-warning">Peringatan (≥80%)</span>`;
    } else {
      alertBadge = `<span class="badge badge-success">Aman</span>`;
    }

    html += `
            <div class="mb-3">
                <div class="card-header p-0 mb-1">
                    <span class="text-sm font-bold">Anggaran Mingguan</span>
                    ${alertBadge}
                </div>
                <div class="progress-container">
                    <div class="progress-bar ${statusClass}" style="width: ${Math.min(pct, 100)}%"></div>
                </div>
                <div class="card-header p-0 text-xs text-muted">
                    <span>Terpakai: ${formatRp(weekExpenses)} / ${formatRp(appState.budgets.weekly)}</span>
                    <span>${pct}%</span>
                </div>
            </div>
        `;
  }

  if (appState.budgets.monthly > 0) {
    const pct = Math.round((monthExpenses / appState.budgets.monthly) * 100);
    let statusClass = "";
    let alertBadge = "";

    if (pct >= 100) {
      statusClass = "danger";
      alertBadge = `<span class="badge badge-danger">Melewati Batas (100%+)</span>`;
    } else if (pct >= 80) {
      statusClass = "warning";
      alertBadge = `<span class="badge badge-warning">Peringatan (≥80%)</span>`;
    } else {
      alertBadge = `<span class="badge badge-success">Aman</span>`;
    }

    html += `
            <div>
                <div class="card-header p-0 mb-1">
                    <span class="text-sm font-bold">Anggaran Bulanan</span>
                    ${alertBadge}
                </div>
                <div class="progress-container">
                    <div class="progress-bar ${statusClass}" style="width: ${Math.min(pct, 100)}%"></div>
                </div>
                <div class="card-header p-0 text-xs text-muted">
                    <span>Terpakai: ${formatRp(monthExpenses)} / ${formatRp(appState.budgets.monthly)}</span>
                    <span>${pct}%</span>
                </div>
            </div>
        `;
  }

  if (appState.budgets.weekly === 0 && appState.budgets.monthly === 0) {
    html = `<p class="text-sm text-muted">Batas anggaran mingguan dan bulanan belum diatur. Atur di menu <strong>Anggaran</strong>.</p>`;
  }

  container.innerHTML = html;
}

function renderDashTargetsWidget() {
  const container = document.getElementById("dashTargetsWidget");
  container.innerHTML = "";

  if (appState.targets.length === 0) {
    container.innerHTML = `<p class="text-sm text-muted">Belum ada target tabungan. Atur di menu <strong>Target Tabungan</strong>.</p>`;
    return;
  }

  appState.targets.slice(0, 3).forEach((target) => {
    const pct = Math.min(
      100,
      Math.round((target.currentProgress / target.targetAmount) * 100),
    );
    const div = document.createElement("div");
    div.className = "mb-3";
    div.innerHTML = `
            <div class="card-header p-0 mb-1">
                <span class="text-sm font-bold">${target.name}</span>
                <span class="badge ${pct >= 100 ? "badge-success" : "badge-info"}">${pct >= 100 ? "Tercapai" : pct + "%"}</span>
            </div>
            <div class="progress-container">
                <div class="progress-bar" style="width: ${pct}%"></div>
            </div>
            <div class="card-header p-0 text-xs text-muted">
                <span>${formatRp(target.currentProgress)} / ${formatRp(target.targetAmount)}</span>
                <span>Sisa: ${formatRp(Math.max(0, target.targetAmount - target.currentProgress))}</span>
            </div>
        `;
    container.appendChild(div);
  });
}

// 2. TRANSAKSI RENDER & LOGIC
function renderTransactionsTable() {
  const searchQuery = document
    .getElementById("txSearchInput")
    .value.toLowerCase();
  const categoryFilter = document.getElementById("txCategoryFilter").value;
  const periodFilter = document.getElementById("txPeriodFilter").value;

  let filtered = filterTransactionsByPeriod(
    appState.transactions,
    periodFilter,
  );

  if (categoryFilter !== "ALL") {
    filtered = filtered.filter((t) => t.category === categoryFilter);
  }

  if (searchQuery.trim() !== "") {
    filtered = filtered.filter((t) =>
      (t.note || "").toLowerCase().includes(searchQuery),
    );
  }

  // Sort latest first
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  const tbody = document.getElementById("txTableBody");
  tbody.innerHTML = "";

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Tidak ada transaksi ditemukan</td></tr>`;
    return;
  }

  filtered.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td>${formatDateIndo(t.date)}</td>
            <td><span class="badge ${t.type === "income" ? "badge-success" : "badge-danger"}">${t.type === "income" ? "Pemasukan" : "Pengeluaran"}</span></td>
            <td>${t.category}</td>
            <td>${t.note || "-"}</td>
            <td class="${t.type === "income" ? "text-success" : "text-danger"} font-bold">
                ${t.type === "income" ? "+" : "-"} ${formatRp(t.amount)}
            </td>
            <td class="text-center">
                <div class="flex-gap-2" style="justify-content: center;">
                    <button class="btn btn-sm btn-outline" onclick="openEditTransaction('${t.id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-sm btn-outline text-danger" onclick="deleteTransaction('${t.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
    tbody.appendChild(tr);
  });
}

function openTransactionModal(txId = null) {
  const modal = document.getElementById("modalTransaction");
  const title = document.getElementById("modalTxTitle");

  if (txId) {
    const tx = appState.transactions.find((t) => t.id === txId);
    if (!tx) return;
    title.textContent = "Edit Transaksi";
    document.getElementById("txId").value = tx.id;
    document.getElementById("txType").value = tx.type;
    document.getElementById("txAmount").value = tx.amount;
    document.getElementById("txDate").value = tx.date;
    document.getElementById("txNote").value = tx.note || "";

    handleTxTypeChange();
    document.getElementById("txCategory").value = tx.category;
  } else {
    title.textContent = "Tambah Transaksi Baru";
    document.getElementById("txId").value = "";
    document.getElementById("txAmount").value = "";
    document.getElementById("txDate").valueAsDate = new Date();
    document.getElementById("txNote").value = "";
    handleTxTypeChange();
  }

  modal.classList.add("show");
}

function closeTransactionModal() {
  document.getElementById("modalTransaction").classList.remove("show");
}

function handleTxTypeChange() {
  const type = document.getElementById("txType").value;
  const catSelect = document.getElementById("txCategory");
  catSelect.innerHTML = "";

  const list = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  list.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    catSelect.appendChild(opt);
  });
}

function handleSaveTransaction(e) {
  e.preventDefault();
  const id = document.getElementById("txId").value;
  const type = document.getElementById("txType").value;
  const amount = parseFloat(document.getElementById("txAmount").value) || 0;
  const category = document.getElementById("txCategory").value;
  const date = document.getElementById("txDate").value;
  const note = document.getElementById("txNote").value.trim();

  if (amount <= 0) {
    alert("Nominal harus lebih dari 0!");
    return;
  }

  // Validasi Saldo Cukup jika Pengeluaran
  if (type === "expense") {
    const currentBal = calculateMainBalance();
    // If editing, add back old transaction amount to simulate balance
    let simulatedBal = currentBal;
    if (id) {
      const oldTx = appState.transactions.find((t) => t.id === id);
      if (oldTx && oldTx.type === "expense") simulatedBal += oldTx.amount;
    }

    if (amount > simulatedBal) {
      alert(
        `Saldo Utama tidak mencukupi! Sisa saldo utama Anda: ${formatRp(simulatedBal)}`,
      );
      return;
    }
  }

  if (id) {
    // Edit
    const index = appState.transactions.findIndex((t) => t.id === id);
    if (index !== -1) {
      appState.transactions[index] = { id, type, amount, category, date, note };
      showToast("Transaksi berhasil diperbarui");
    }
  } else {
    // Create
    const newTx = {
      id: "tx_" + Date.now(),
      type,
      amount,
      category,
      date,
      note,
    };
    appState.transactions.push(newTx);
    showToast("Transaksi baru berhasil ditambahkan");
  }

  saveLocalStorage();
  closeTransactionModal();
}

function openEditTransaction(id) {
  openTransactionModal(id);
}

function deleteTransaction(id) {
  if (confirm("Apakah Anda yakin ingin menghapus transaksi ini?")) {
    appState.transactions = appState.transactions.filter((t) => t.id !== id);
    saveLocalStorage();
    showToast("Transaksi telah dihapus");
  }
}

// 3. ANGGARAN RENDER & LOGIC
function populateBudgetInputDefaults() {
  document.getElementById("budgetWeeklyInput").value =
    appState.budgets.weekly || "";
  document.getElementById("budgetMonthlyInput").value =
    appState.budgets.monthly || "";

  document.getElementById("catBudget_MakanMinum").value =
    appState.budgets.categories["Makan & Minum"] || "";
  document.getElementById("catBudget_Transportasi").value =
    appState.budgets.categories["Transportasi"] || "";
  document.getElementById("catBudget_Kuliah").value =
    appState.budgets.categories["Kuliah"] || "";
  document.getElementById("catBudget_Laundry").value =
    appState.budgets.categories["Laundry"] || "";
  document.getElementById("catBudget_Hiburan").value =
    appState.budgets.categories["Hiburan"] || "";
  document.getElementById("catBudget_Lainnya").value =
    appState.budgets.categories["Lainnya (Pengeluaran)"] || "";
}

function handleSaveBudgets(e) {
  e.preventDefault();
  appState.budgets.weekly =
    parseFloat(document.getElementById("budgetWeeklyInput").value) || 0;
  appState.budgets.monthly =
    parseFloat(document.getElementById("budgetMonthlyInput").value) || 0;

  appState.budgets.categories["Makan & Minum"] =
    parseFloat(document.getElementById("catBudget_MakanMinum").value) || 0;
  appState.budgets.categories["Transportasi"] =
    parseFloat(document.getElementById("catBudget_Transportasi").value) || 0;
  appState.budgets.categories["Kuliah"] =
    parseFloat(document.getElementById("catBudget_Kuliah").value) || 0;
  appState.budgets.categories["Laundry"] =
    parseFloat(document.getElementById("catBudget_Laundry").value) || 0;
  appState.budgets.categories["Hiburan"] =
    parseFloat(document.getElementById("catBudget_Hiburan").value) || 0;
  appState.budgets.categories["Lainnya (Pengeluaran)"] =
    parseFloat(document.getElementById("catBudget_Lainnya").value) || 0;

  saveLocalStorage();
  showToast("Batas anggaran berhasil disimpan!");
}

function renderBudgets() {
  const container = document.getElementById("budgetMonitorContainer");
  container.innerHTML = "";

  const weekExpenses = filterTransactionsByPeriod(appState.transactions, "WEEK")
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  const monthExpenses = filterTransactionsByPeriod(
    appState.transactions,
    "MONTH",
  )
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  // Filter month expenses grouped by category
  const categoryMonthExpenses = {};
  EXPENSE_CATEGORIES.forEach((c) => (categoryMonthExpenses[c] = 0));
  filterTransactionsByPeriod(appState.transactions, "MONTH")
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      if (categoryMonthExpenses[t.category] !== undefined) {
        categoryMonthExpenses[t.category] += t.amount;
      }
    });

  let html = "";

  // Overall Weekly Budget Box
  if (appState.budgets.weekly > 0) {
    html += createBudgetBarHTML(
      "Anggaran Mingguan (Senin-Minggu)",
      weekExpenses,
      appState.budgets.weekly,
    );
  }

  // Overall Monthly Budget Box
  if (appState.budgets.monthly > 0) {
    html += createBudgetBarHTML(
      "Anggaran Bulanan Kalender",
      monthExpenses,
      appState.budgets.monthly,
    );
  }

  // Category Budgets Header
  html += `<h4 class="mt-4 mb-2">Evaluasi Anggaran Per Kategori (Bulan Ini)</h4>`;

  let hasCategoryBudgets = false;
  EXPENSE_CATEGORIES.forEach((cat) => {
    const limit = appState.budgets.categories[cat] || 0;
    if (limit > 0) {
      hasCategoryBudgets = true;
      const spent = categoryMonthExpenses[cat] || 0;
      html += createBudgetBarHTML(`Kategori: ${cat}`, spent, limit);
    }
  });

  if (
    !hasCategoryBudgets &&
    appState.budgets.weekly === 0 &&
    appState.budgets.monthly === 0
  ) {
    html = `<div class="alert alert-info">Belum ada batas anggaran yang diatur. Silakan isi form di sebelah kiri untuk mengaktifkan pemantauan anggaran.</div>`;
  }

  container.innerHTML = html;
}

function createBudgetBarHTML(label, spent, limit) {
  const pct = Math.round((spent / limit) * 100);
  const remaining = limit - spent;
  let colorClass = "success";
  let alertMsg = "";

  if (pct >= 100) {
    colorClass = "danger";
    alertMsg = `<div class="alert alert-danger my-4"><i class="fa-solid fa-triangle-exclamation"></i> PERINGATAN: Pengeluaran untuk ${label} telah MELEWATI BATAS ANGGARAN (${pct}%)! Sisa: ${formatRp(remaining)}</div>`;
  } else if (pct >= 80) {
    colorClass = "warning";
    alertMsg = `<div class="alert alert-warning my-4"><i class="fa-solid fa-triangle-exclamation"></i> PERHATIAN: Pengeluaran untuk ${label} mendekati batas (${pct}%). Sisa: ${formatRp(remaining)}</div>`;
  }

  return `
        <div class="card mb-3 bg-light">
            <div class="card-header p-0 mb-1">
                <strong>${label}</strong>
                <span class="badge badge-${colorClass}">${pct}%</span>
            </div>
            <div class="progress-container">
                <div class="progress-bar ${colorClass}" style="width: ${Math.min(pct, 100)}%"></div>
            </div>
            <div class="card-header p-0 text-xs text-muted">
                <span>Terpakai: ${formatRp(spent)} dari ${formatRp(limit)}</span>
                <span>${remaining >= 0 ? "Sisa: " + formatRp(remaining) : "Defisit: " + formatRp(Math.abs(remaining))}</span>
            </div>
            ${alertMsg}
        </div>
    `;
}

// 4. CELENGAN VIRTUAL RENDER & LOGIC
function renderPiggyBank() {
  const piggyBal = calculatePiggyBalance();
  document.getElementById("piggyBalanceDisplay").textContent =
    formatRp(piggyBal);

  const tbody = document.getElementById("piggyHistoryBody");
  tbody.innerHTML = "";

  const transfers = [...appState.piggyTransfers].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );

  if (transfers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Belum ada riwayat transfer celengan</td></tr>`;
    return;
  }

  transfers.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td>${formatDateIndo(t.date)}</td>
            <td><span class="badge ${t.type === "deposit" ? "badge-success" : "badge-warning"}">${t.type === "deposit" ? "Setoran" : "Penarikan"}</span></td>
            <td>${t.note || "-"}</td>
            <td class="${t.type === "deposit" ? "text-success" : "text-danger"} font-bold">
                ${t.type === "deposit" ? "+" : "-"} ${formatRp(t.amount)}
            </td>
        `;
    tbody.appendChild(tr);
  });
}

function handlePiggyDeposit(e) {
  e.preventDefault();
  const amount =
    parseFloat(document.getElementById("piggyDepositAmount").value) || 0;
  const note = document.getElementById("piggyDepositNote").value.trim();

  if (amount <= 0) {
    alert("Nominal harus lebih dari 0!");
    return;
  }

  const mainBal = calculateMainBalance();
  if (amount > mainBal) {
    alert(
      `Saldo utama tidak mencukupi! Saldo utama Anda: ${formatRp(mainBal)}`,
    );
    return;
  }

  appState.piggyTransfers.push({
    id: "pgy_" + Date.now(),
    type: "deposit",
    amount,
    note,
    date: new Date().toISOString(),
  });

  saveLocalStorage();
  document.getElementById("formPiggyDeposit").reset();
  showToast("Berhasil menyetor uang ke celengan!");
}

function handlePiggyWithdraw(e) {
  e.preventDefault();
  const amount =
    parseFloat(document.getElementById("piggyWithdrawAmount").value) || 0;
  const note = document.getElementById("piggyWithdrawNote").value.trim();

  if (amount <= 0) {
    alert("Nominal harus lebih dari 0!");
    return;
  }

  const piggyBal = calculatePiggyBalance();
  if (amount > piggyBal) {
    alert(
      `Saldo celengan tidak mencukupi! Saldo celengan Anda: ${formatRp(piggyBal)}`,
    );
    return;
  }

  appState.piggyTransfers.push({
    id: "pgy_" + Date.now(),
    type: "withdraw",
    amount,
    note,
    date: new Date().toISOString(),
  });

  saveLocalStorage();
  document.getElementById("formPiggyWithdraw").reset();
  showToast("Berhasil menarik uang dari celengan ke saldo utama!");
}

// 5. TARGET TABUNGAN RENDER & LOGIC
function renderTargets() {
  const grid = document.getElementById("targetCardsGrid");
  grid.innerHTML = "";

  if (appState.targets.length === 0) {
    grid.innerHTML = `<div class="card p-4 text-center text-muted" style="grid-column: span 2;">Belum ada target tabungan yang dibuat. Silakan isi form di sebelah kanan.</div>`;
    return;
  }

  appState.targets.forEach((target) => {
    const pct = Math.min(
      100,
      Math.round((target.currentProgress / target.targetAmount) * 100),
    );
    const isReached = target.currentProgress >= target.targetAmount;
    const remaining = Math.max(0, target.targetAmount - target.currentProgress);

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
            <div class="card-header">
                <h3><i class="fa-solid fa-bullseye text-primary"></i> ${target.name}</h3>
                <span class="badge ${isReached ? "badge-success" : "badge-warning"}">
                    ${isReached ? "Tercapai" : "Belum tercapai"}
                </span>
            </div>
            <div class="my-2">
                <div class="card-header p-0 text-sm">
                    <span>Progres: <strong>${formatRp(target.currentProgress)}</strong> / ${formatRp(target.targetAmount)}</span>
                    <span class="font-bold">${pct}%</span>
                </div>
                <div class="progress-container">
                    <div class="progress-bar ${isReached ? "success" : ""}" style="width: ${pct}%"></div>
                </div>
                <p class="text-xs text-muted mt-1">Sisa Target: <strong>${formatRp(remaining)}</strong></p>
            </div>
            <div class="flex-gap-2 mt-4">
                <button class="btn btn-sm btn-primary flex-1" onclick="openUpdateTargetModal('${target.id}')">
                    <i class="fa-solid fa-pen-to-square"></i> Update Progres
                </button>
                <button class="btn btn-sm btn-outline text-danger" onclick="deleteTarget('${target.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
    grid.appendChild(card);
  });
}

function handleCreateTarget(e) {
  e.preventDefault();
  const name = document.getElementById("targetNameInput").value.trim();
  const targetAmount =
    parseFloat(document.getElementById("targetAmountInput").value) || 0;
  const initialProgress =
    parseFloat(document.getElementById("targetInitialProgress").value) || 0;

  if (targetAmount <= 0) {
    alert("Nominal target harus lebih besar dari 0!");
    return;
  }

  if (initialProgress < 0) {
    alert("Progres awal tidak boleh negatif!");
    return;
  }

  const newTarget = {
    id: "tgt_" + Date.now(),
    name,
    targetAmount,
    currentProgress: initialProgress,
  };

  appState.targets.push(newTarget);
  saveLocalStorage();
  document.getElementById("formCreateTarget").reset();
  showToast("Target tabungan baru berhasil dibuat!");
}

function openUpdateTargetModal(targetId) {
  const target = appState.targets.find((t) => t.id === targetId);
  if (!target) return;

  document.getElementById("targetUpdateId").value = target.id;
  document.getElementById("targetUpdateNameDisplay").textContent =
    `Target: ${target.name}`;
  document.getElementById("targetProgressInput").value = target.currentProgress;

  document.getElementById("modalUpdateTarget").classList.add("show");
}

function closeUpdateTargetModal() {
  document.getElementById("modalUpdateTarget").classList.remove("show");
}

function handleUpdateTargetProgress(e) {
  e.preventDefault();
  const id = document.getElementById("targetUpdateId").value;
  const progress = parseFloat(
    document.getElementById("targetProgressInput").value,
  );

  if (isNaN(progress) || progress < 0) {
    alert("Progres aktual tidak boleh negatif!");
    return;
  }

  const target = appState.targets.find((t) => t.id === id);
  if (target) {
    target.currentProgress = progress;
    saveLocalStorage();
    closeUpdateTargetModal();
    showToast("Progres target berhasil diperbarui!");
  }
}

function deleteTarget(id) {
  if (confirm("Apakah Anda yakin ingin menghapus target tabungan ini?")) {
    appState.targets = appState.targets.filter((t) => t.id !== id);
    saveLocalStorage();
    showToast("Target tabungan telah dihapus");
  }
}

// 6. REKAP & LAPORAN RENDER & LOGIC
function renderReportTable() {
  const period = document.getElementById("reportPeriodSelect").value;
  const filtered = filterTransactionsByPeriod(appState.transactions, period);

  // Sort by date ascending for report table
  filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

  const tbody = document.getElementById("reportTableBody");
  tbody.innerHTML = "";

  let totalIncome = 0;
  let totalExpense = 0;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Tidak ada data transaksi untuk periode ini</td></tr>`;
  } else {
    filtered.forEach((t, idx) => {
      if (t.type === "income") totalIncome += t.amount;
      if (t.type === "expense") totalExpense += t.amount;

      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td>${idx + 1}</td>
                <td>${formatDateIndo(t.date)}</td>
                <td>${t.type === "income" ? "Pemasukan" : "Pengeluaran"}</td>
                <td>${t.category}</td>
                <td>${t.note || "-"}</td>
                <td class="${t.type === "income" ? "text-success" : "text-danger"} font-bold">
                    ${t.type === "income" ? "+" : "-"} ${formatRp(t.amount)}
                </td>
            `;
      tbody.appendChild(tr);
    });
  }

  document.getElementById("reportTotalIncome").textContent =
    formatRp(totalIncome);
  document.getElementById("reportTotalExpense").textContent =
    formatRp(totalExpense);
  const netFlow = totalIncome - totalExpense;
  const netEl = document.getElementById("reportNetFlow");
  netEl.textContent = formatRp(netFlow);
  netEl.className = netFlow >= 0 ? "text-success" : "text-danger";

  // Print Text Update
  const periodMap = {
    TODAY: "Hari Ini",
    WEEK: "Minggu Ini",
    MONTH: "Bulan Ini",
    ALL: "Seluruh Periode",
  };
  document.getElementById("printPeriodText").textContent =
    `Periode: ${periodMap[period]}`;
  document.getElementById("printDateText").textContent =
    `Dicetak pada: ${new Date().toLocaleString("id-ID")}`;
}

function exportToPDFPrint() {
  window.print();
}

// 7. BACKUP & RESTORE DATA JSON
function exportJSONData() {
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(appState, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute(
    "download",
    `KostCalc_Backup_${new Date().toISOString().slice(0, 10)}.json`,
  );
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("File backup JSON berhasil diunduh!");
}

function importJSONData() {
  const fileInput = document.getElementById("importJSONFile");
  const file = fileInput.files[0];

  if (!file) {
    alert("Silakan pilih berkas JSON terlebih dahulu!");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported && typeof imported === "object") {
        appState = { ...appState, ...imported };
        saveLocalStorage();
        showToast("Data berhasil direstore!");
        fileInput.value = "";
      } else {
        alert("Format JSON tidak valid!");
      }
    } catch (err) {
      alert("Gagal membaca file JSON: " + err.message);
    }
  };
  reader.readAsText(file);
}

function resetAllData() {
  if (
    confirm(
      "PERINGATAN! Seluruh data transaksi, anggaran, celengan, dan target akan DIHAPUS PERMANEN. Lanjutkan?",
    )
  ) {
    localStorage.removeItem(STORAGE_KEY);
    appState = {
      initialBalance: 0,
      transactions: [],
      piggyTransfers: [],
      budgets: {
        weekly: 0,
        monthly: 0,
        categories: {
          "Makan & Minum": 0,
          Transportasi: 0,
          Kuliah: 0,
          Laundry: 0,
          Hiburan: 0,
          "Lainnya (Pengeluaran)": 0,
        },
      },
      targets: [],
    };
    updateAllViews();
    showToast("Seluruh data berhasil dihapus");
  }
}

// ================= MODAL & TOAST HELPERS =================
function openInitialBalanceModal() {
  document.getElementById("initialBalanceInput").value =
    appState.initialBalance;
  document.getElementById("modalInitialBalance").classList.add("show");
}

function closeInitialBalanceModal() {
  document.getElementById("modalInitialBalance").classList.remove("show");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 3000);
}
