import React from "react";
import "./PageNotFound.css";
import Login from "./User/Login";

const PageNotFound = () => {
  return (
    <>
      <div className="notfound-page">
        <div className="container">
          <h1>404</h1>
          <h2>Page Not Found</h2>
          <p>The page you’re looking for doesn’t exist.</p>
          <button className="btn" onClick={() => window.location.href = "/login"}>Go Home</button>
        </div>
      </div>
    </>
  );
};

export default PageNotFound;
