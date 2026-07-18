import { Link } from "react-router-dom";
import logo from "../assets/logo.png";

type BrandProps = {
  to?: string;
  onClick?: () => void;
};

export function Brand({ to = "/", onClick }: BrandProps) {
  const content = (
    <>
      <img className="brand-mark" src={logo} alt="" aria-hidden />
      <span className="brand-name">Meridian</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="brand" onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <Link className="brand" to={to}>
      {content}
    </Link>
  );
}
