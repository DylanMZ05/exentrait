// src/components/Header.tsx
import { Link } from "react-router-dom";
import logo from "../assets/logo-2.png"; // ajustá el path a tu logo

export default function Header() {
  return (
    <header className="bg-[#0b0c1a] py-6 px-6 shadow-md">
      <div className="flex items-center">
        <Link to="/">
          <img
            src={logo}
            alt="Exentra Logo"
            className="h-10 w-auto cursor-pointer transition-transform duration-200 hover:scale-105"
          />
        </Link>
      </div>
    </header>
  );
}
