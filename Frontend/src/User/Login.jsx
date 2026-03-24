const AUTH_URL = import.meta.env.VITE_AUTH_SERVICE_URL;
import { useState } from "react";
import logo from "./../../public/logo.png";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const initialRole =
    new URLSearchParams(location.search).get("role") === "owner"
      ? "owner"
      : "user";
  const [role, setRole] = useState(initialRole);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      newErrors.email = "Enter a valid email address";
    }

    if (!password.trim()) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!validate()) {
      toast.error("Please fix the errors before submitting");
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post(`${AUTH_URL}/login`, {
        email,
        password,
        role,
      });
      const data = res.data;

      localStorage.setItem("token", data.token);
      localStorage.setItem(
        "authUser",
        JSON.stringify({
          email: data?.user?.email,
          username: data?.user?.username,
          firstName: data?.user?.fullName?.firstName,
          lastName: data?.user?.fullName?.lastName,
          role: data?.user?.role || role,
        }),
      );
      toast.success("Login successful 🎉");
      toast.info("Getting you in...", { position: "top-left" });
      setEmail("");
      setPassword("");
      setErrors({});
      setTimeout(() => {
        navigate(role === "owner" ? "/owner/dashboard" : "/products");
      }, 1500);
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "We could not sign you in. Please check your email and password.",
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

      <h2>Login to BakeFlow</h2>

      <form onSubmit={handleLogin} noValidate>
        <div className="auth-role-toggle" role="group" aria-label="Login role">
          <button
            type="button"
            className={`auth-role-btn ${role === "user" ? "auth-role-btn--active" : ""}`}
            onClick={() => setRole("user")}
            disabled={loading}
          >
            User
          </button>
          <button
            type="button"
            className={`auth-role-btn ${role === "owner" ? "auth-role-btn--active" : ""}`}
            onClick={() => setRole("owner")}
            disabled={loading}
          >
            Owner
          </button>
        </div>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={errors.email ? "input-error" : ""}
        />
        {errors.email && <small className="error">{errors.email}</small>}

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={errors.password ? "input-error" : ""}
        />
        {errors.password && <small className="error">{errors.password}</small>}

        <button disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      <p style={{ marginTop: "20px", fontSize: "13px", opacity: 0.7 }}>
        Don’t have an account?{" "}
        <span className="link" onClick={() => navigate("/register")}>
          Register
        </span>
      </p>
    </div>
  );
};

export default Login;
