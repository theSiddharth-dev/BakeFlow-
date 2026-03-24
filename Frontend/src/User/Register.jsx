const API_URL = import.meta.env.VITE_AUTH_SERVICE_URL;

import { useState } from "react";
import logo from "./../../public/logo.png";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const Register = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");

  const validate = () => {
    const newErrors = {};

    if (!username.trim()) {
      newErrors.username = "Username is required";
    } else if (typeof username !== "string") {
      newErrors.username = "Username must be a string";
    } else if (username.trim().length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    }

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      newErrors.email = "Enter a valid email address";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (!firstName.trim()) {
      newErrors.firstName = "First name is required";
    } else if (typeof firstName !== "string") {
      newErrors.firstName = "First name must be a string";
    }

    if (!lastName.trim()) {
      newErrors.lastName = "Last name is required";
    } else if (typeof lastName !== "string") {
      newErrors.lastName = "Last name must be a string";
    }

    if (!address.trim()) {
      newErrors.address = "Address is required";
    } else if (typeof address !== "string") {
      newErrors.address = "Address must be a string";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!validate()) {
      toast.error("Please fix the errors before submitting");
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/register`, {
        username,
        email,
        password,
        fullName: {
          firstName,
          lastName,
        },
        address: [
          {
            street: address.trim(),
            isDefault: true,
          },
        ],
      });

      const data = await res.data;
      console.log("data => ", data);

      toast.success("Account created 🎉 Please login");
      setUsername("");
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
      setAddress("");
      setErrors({});
      navigate("/login");
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "We could not create your account. Please verify your details and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <img src={logo} alt="BakeFlow" className="logo" />

      <h1
        style={{
          background: "linear-gradient(to right, #ff7a00, #ffb400)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          fontWeight: "bold",
          fontSize: "1.8rem",
          marginBottom: "5px",
        }}
      >
        Welcome to BakeFlow
      </h1>

      <h2>Create BakeFlow Account</h2>

      <form onSubmit={handleRegister} noValidate>
        {/* Name row (side-by-side) */}
        <div className="row">
          <div className="field">
            <input
              type="string"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={errors.firstName ? "input-error" : ""}
            />
            {errors.firstName && (
              <small className="error">{errors.firstName}</small>
            )}
          </div>

          <div className="field">
            <input
              type="string"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={errors.lastName ? "input-error" : ""}
            />
            {errors.lastName && (
              <small className="error">{errors.lastName}</small>
            )}
          </div>
        </div>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={errors.username ? "input-error" : ""}
        />
        {errors.username && <small className="error">{errors.username}</small>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={errors.email ? "input-error" : ""}
        />
        {errors.email && <small className="error">{errors.email}</small>}

        <input
          type="text"
          placeholder="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={errors.address ? "input-error" : ""}
        />
        {errors.address && <small className="error">{errors.address}</small>}

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={errors.password ? "input-error" : ""}
        />
        {errors.password && <small className="error">{errors.password}</small>}

        <button
          disabled={
            loading ||
            !firstName ||
            !lastName ||
            !email ||
            !address ||
            !password
          }
        >
          {loading ? "Creating..." : "Register"}
        </button>
      </form>

      <p style={{ marginTop: "10px", fontSize: "13px", opacity: 0.7 }}>
        Already have an account?{" "}
        <span
          className="link"
          onClick={() => navigate("/login")}
          style={{
            pointerEvents: loading ? "none" : "auto",
            opacity: loading ? 0.6 : 1,
          }}
        >
          Login
        </span>
      </p>
    </div>
  );
};

export default Register;
