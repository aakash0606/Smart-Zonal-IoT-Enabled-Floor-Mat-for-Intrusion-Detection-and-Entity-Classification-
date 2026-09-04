import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
    import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
    import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

    // ✅ UPDATED FIREBASE CONFIG (YOUR ANTITHEFT PROJECT)
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
    const db = getDatabase(app);

    document.getElementById('createBtn').addEventListener('click', async () => {
      const fullname = document.getElementById('fullname').value;
      const security = document.getElementById('security').value;
      const email = document.getElementById('email').value;
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;

      if(!fullname || !security || !email || !username || !password) {
        alert("Please fill all fields.");
        return;
      }

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await set(ref(db, "users/" + user.uid), {
          fullname,
          security,
          email,
          username
        });

        alert("Account created successfully!");
        window.location.href = "signin.html";
      } catch (error) {
        alert("Error: " + error.message);
      }
    });