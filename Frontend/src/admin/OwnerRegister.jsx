const API_URL = import.meta.env.VITE_AUTH_SERVICE_URL;
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import logo from "./../../public/logo.png";
import axios from "axios";

const OwnerRegister = () => {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!firstName || !lastName || !username || !email || !password) {
      toast.error("All fields are required");
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/register`, {
        fullName: { firstName, lastName },
        username,
        email,
        password,
        role: "owner",
      });

      const data = res.data;

      console.log(data);

      toast.success("Owner account created 🎉");
      setFirstName("");
      setLastName("");
      setUsername("");
      setEmail("");
      setPassword("");
      navigate("/login?role=owner");
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Owner account could not be created. Please verify details and try again.",
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

      <h2>Register Owner</h2>

      <form onSubmit={handleRegister}>
        <div className="row">
          <div className="row">
            <div className="field">
              <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>

            <div className="field">
              <input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
        </div>

        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button disabled={loading}>
          {loading ? "Creating..." : "Create Owner Account"}
        </button>
      </form>

      <p style={{ marginTop: "10px", fontSize: "13px", opacity: 0.7 }}>
        Already have an account?{" "}
        <span
          className="link"
          onClick={() => navigate("/login?role=owner")}
          style={{ cursor: "pointer", color: "#ff7a00" }}
        >
          Login here
        </span>
      </p>
    </div>
  );
};

export default OwnerRegister;
