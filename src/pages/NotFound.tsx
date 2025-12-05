import { useLocation, useNavigate, Link } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if the path contains URL-encoded query params (e.g., %3F for ?)
    const decodedPath = decodeURIComponent(location.pathname);
    
    if (decodedPath !== location.pathname && decodedPath.includes("?")) {
      // Path was URL-encoded - redirect to the decoded version
      const [path, queryString] = decodedPath.split("?");
      navigate(`${path}?${queryString}`, { replace: true });
      return;
    }

    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <Link to="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
