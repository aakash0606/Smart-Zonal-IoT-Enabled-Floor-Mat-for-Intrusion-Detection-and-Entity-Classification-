import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";


// ✅ UPDATED FIREBASE CONFIG (your new account)
const firebaseConfig = {
  apiKey: "AIzaSyBnH9HWVaNvy1N8tg86QwC0ajwt1VYlrS4",
  authDomain: "anti-theft-flooring-mat.firebaseapp.com",
  databaseURL: "https://anti-theft-flooring-mat-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "anti-theft-flooring-mat",
  storageBucket: "anti-theft-flooring-mat.firebasestorage.app",
  messagingSenderId: "3148433465",
  appId: "1:3148433465:web:9e69d98c1e03046f9725e8",
  measurementId: "G-XFB5F8CWL2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

const profileBtn    = document.getElementById('profileBtn');
const profileModal  = document.getElementById('profileModal');
const profileContent= document.getElementById('profileContent');
const logoutBtn     = document.getElementById('logoutBtn');
const closeModal    = document.getElementById('closeModal');

onAuthStateChanged(auth, user => {
  if (user) {
    window.currentUid = user.uid;
  } else {
    window.location.href = "signin.html";
  }
});

profileBtn.addEventListener('click', async () => {
  if (!window.currentUid) return;
  try {
    const snap = await get(child(ref(db), `users/${window.currentUid}`));
    if (snap.exists()) {
      const data = snap.val();
      profileContent.innerHTML = `
        <p><strong>Full Name:</strong> ${data.fullname}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Username:</strong> ${data.username}</p>
        <p><strong>Security Area:</strong> ${data.security}</p>
      `;
    } else {
      profileContent.textContent = "No extra profile data found.";
    }
    profileModal.style.display = 'flex';
  } catch (err) {
    profileContent.textContent = "Error loading profile: " + err;
    profileModal.style.display = 'flex';
  }
});

closeModal.onclick = () => profileModal.style.display = 'none';
logoutBtn.onclick  = () => signOut(auth);