// Import Firebase
    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
    import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

    // ✅ Updated Firebase Configuration (your new project)
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

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);

    // Sign In function
    document.getElementById("signinBtn").addEventListener("click", async () => {
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;

      if(!email || !password) {
        alert("Please fill in both fields.");
        return;
      }

      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        alert("Login successful! Welcome " + user.email);
        // Redirect to dashboard
        window.location.href = "dashboard.html";
      } catch (error) {
        alert("Login failed: " + error.message);
      }
    });

    // Redirect to Register page
    function goToRegister() {
      window.location.href = 'register.html';
    }
    window.goToRegister = goToRegister;