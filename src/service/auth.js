import { auth } from "./firebase"; 
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth"; 

export const signUp = async (email, password) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("Signup Success:", userCredential);
        return userCredential.user;  
    } catch (error) {
        console.error("Signup Error:", error.code, error.message);
        return null;
    }
};

export const signIn = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("Login Success:", userCredential);
        return userCredential.user;
    } catch (error) {
        console.error("Login Error:", error.code, error.message);
        return null;
    }
};
