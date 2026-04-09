import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyANbqn5Fb-oWh7uZI5l-YCR6x4dvl3Dg5Q",
  authDomain: "scoutingdashboard-c0b52.firebaseapp.com",
  projectId: "scoutingdashboard-c0b52",
  storageBucket: "scoutingdashboard-c0b52.firebasestorage.app",
  messagingSenderId: "216422354352",
  appId: "1:216422354352:web:e98cddab667a5f294f9a75",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
