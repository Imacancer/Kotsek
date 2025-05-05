import Link from "next/link";
import MaxWidthWrapper from "./MaxWidthWrapper";

const Footer = () => {
  return (
    <footer className="bg-[#b1b1b2] h-20 relative">
      <MaxWidthWrapper>
        <div className="border-t border-[#b1b1b2]" />

        <div className="h-full flex flex-col md:flex-row md:justify-between justify-center items-center">
          <div className="text-center md:text-left pb-2 md:pb-0">
            <p className="text-sm text-muted-foreground text-slate-900">
              &copy; {new Date().getFullYear()} KoTsek. All rights reserved.
            </p>
          </div>

          <div className="flex items-center justify-center">
            <div className="flex space-x-8">
              <Link
                href="#"
                className="text-sm text-muted-foreground text-slate-900 hover:text-white"
              >
                Terms And Conditions
              </Link>
              <Link
                href="#"
                className="text-sm text-muted-foreground text-slate-900 hover:text-white"
              >
                Privacy Policy
              </Link>
              <Link
                href="#"
                className="text-sm text-muted-foreground text-slate-900 hover:text-white"
              >
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </MaxWidthWrapper>
    </footer>
  );
};

export default Footer;
