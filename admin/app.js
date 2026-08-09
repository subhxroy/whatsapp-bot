// Standalone Netlify Admin Portal Logic
const firebaseConfig = {
  apiKey: "AIzaSyBRb2LpYI5_jSyTV5jzFytkPymJkSp494Y",
  authDomain: "openify-studio.firebaseapp.com",
  projectId: "openify-studio",
  storageBucket: "openify-studio.firebasestorage.app",
  messagingSenderId: "273942133834",
  appId: "1:273942133834:web:59c945d16ece86d498fab3"
};

// Allowed Master Admin Accounts (NOBODY ELSE CAN ACCESS)
const ALLOWED_ADMIN_EMAILS = [
  'contact.subhroy@gmail.com',
  'aarxslan@gmail.com'
];

let app, auth, db;
try {
  app = firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
} catch (e) {
  console.warn('Firebase initialized via global or config fallback.');
}

const API_BASE_URL = 'https://caldera-bot-api.onrender.com';

const authCard = document.getElementById('authCard');
const adminDashboard = document.getElementById('adminDashboard');
const authError = document.getElementById('authError');
const userInfo = document.getElementById('userInfo');
const userEmailTag = document.getElementById('userEmailTag');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const emailLoginForm = document.getElementById('emailLoginForm');
const logoutBtn = document.getElementById('logoutBtn');
const actionNotice = document.getElementById('actionNotice');

const pendingCountEl = document.getElementById('pendingCount');
const totalRevenueEl = document.getElementById('totalRevenue');
const revenueSubEl = document.getElementById('revenueSub');
const approvedCountEl = document.getElementById('approvedCount');
const totalCountEl = document.getElementById('totalCount');
const tableBody = document.getElementById('paymentsTableBody');

let allRequests = [];
let currentFilter = 'ALL';

// Auth State Listener
auth.onAuthStateChanged((user) => {
  if (user && user.email) {
    const userEmail = user.email.toLowerCase();
    if (ALLOWED_ADMIN_EMAILS.includes(userEmail)) {
      // Access Granted
      authCard.style.display = 'none';
      adminDashboard.style.display = 'block';
      userInfo.style.display = 'flex';
      userEmailTag.textContent = `Admin: ${user.email}`;
      authError.style.display = 'none';
      subscribeToPayments();
    } else {
      // ACCESS DENIED
      auth.signOut();
      showError(`⛔ ACCESS DENIED: The account (${user.email}) is not an authorized administrator. Only contact.subhroy@gmail.com and aarxslan@gmail.com are permitted.`);
      authCard.style.display = 'block';
      adminDashboard.style.display = 'none';
      userInfo.style.display = 'none';
    }
  } else {
    authCard.style.display = 'block';
    adminDashboard.style.display = 'none';
    userInfo.style.display = 'none';
  }
});

// Google Sign In
googleLoginBtn.addEventListener('click', () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch((err) => {
    showError(err.message);
  });
});

// Email Login
emailLoginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  auth.signInWithEmailAndPassword(email, password).catch((err) => {
    showError(err.message);
  });
});

// Logout
logoutBtn.addEventListener('click', () => {
  auth.signOut();
});

function showError(msg) {
  authError.textContent = msg;
  authError.style.display = 'block';
}

// Real-time Firestore Payments Listener
function subscribeToPayments() {
  db.collection('payments').onSnapshot((snap) => {
    allRequests = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderDashboard();
  }, (err) => {
    console.warn('Firestore snapshot fallbacks:', err);
    fetchFromApi();
  });
}

async function fetchFromApi() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/payment/admin/requests`);
    if (res.ok) {
      const data = await res.json();
      allRequests = data.requests || [];
      renderDashboard();
    }
  } catch {}
}

function renderDashboard() {
  const pending = allRequests.filter(r => r.status === 'PENDING').length;
  const approved = allRequests.filter(r => r.status === 'APPROVED').length;
  const totalRev = approved * 150;

  pendingCountEl.textContent = pending;
  approvedCountEl.textContent = approved;
  totalCountEl.textContent = allRequests.length;
  totalRevenueEl.textContent = `₹${totalRev}`;
  revenueSubEl.textContent = `₹150 x ${approved} approved users`;

  // Render Table
  renderTable();
}

function renderTable() {
  const filtered = allRequests.filter(r => {
    if (currentFilter === 'ALL') return true;
    return r.status === currentFilter;
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-muted">No ${currentFilter.toLowerCase()} payment submissions found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map(req => `
    <tr>
      <td><strong>${req.userEmail || req.userId}</strong></td>
      <td class="font-mono text-blue font-bold">${req.utrNumber}</td>
      <td><strong>₹${req.amount || 150}</strong></td>
      <td><span class="status-badge status-${req.status}">${req.status}</span></td>
      <td>${new Date(req.createdAt).toLocaleString()}</td>
      <td class="text-right">
        ${req.status === 'PENDING' ? `
          <button onclick="approvePayment('${req.id}')" class="btn btn-primary btn-sm">Approve Access</button>
          <button onclick="rejectPayment('${req.id}')" class="btn btn-secondary btn-sm">Reject</button>
        ` : req.status === 'APPROVED' ? `
          <button onclick="rejectPayment('${req.id}')" class="btn btn-secondary btn-sm" style="background-color: #fc5000; color: #ffffff; font-weight: bold;" title="Revoke user access & disconnect WhatsApp session">Revoke Access</button>
        ` : `
          <button onclick="approvePayment('${req.id}')" class="btn btn-primary btn-sm">Re-Approve Access</button>
        `}
      </td>
    </tr>
  `).join('');
}

// Filter button handlers
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.getAttribute('data-filter');
    renderTable();
  });
});

window.approvePayment = async function(id) {
  try {
    await db.collection('payments').doc(id).set({ status: 'APPROVED', updatedAt: new Date().toISOString() }, { merge: true });
  } catch {}
  try {
    await fetch(`${API_BASE_URL}/api/payment/admin/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId: id })
    });
  } catch {}
  showNotice('✅ User payment approved! Access granted.');
  fetchFromApi();
};

window.rejectPayment = async function(id) {
  try {
    await db.collection('payments').doc(id).set({ status: 'REJECTED', updatedAt: new Date().toISOString() }, { merge: true });
  } catch {}
  try {
    await fetch(`${API_BASE_URL}/api/payment/admin/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId: id })
    });
  } catch {}
  showNotice('⛔ User access revoked and session disconnected.');
  fetchFromApi();
};

function showNotice(msg) {
  actionNotice.textContent = msg;
  actionNotice.style.display = 'block';
  setTimeout(() => { actionNotice.style.display = 'none'; }, 4000);
}
