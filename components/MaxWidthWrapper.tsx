import { cn } from "@/lib/utils";
import { ReactNode } from "react";

const MaxWidthWrapper = ({
  classname,
  children,
}: {
  classname?: string;
  children: ReactNode;
}) => {
  return (
    <div
      className={cn(
        "h-full mx-auto w-full max-w-screen-xl px-2.5 md:px-20",
        classname
      )}
    >
      {children}
    </div>
  );
};

export default MaxWidthWrapper;

//This component is for wrapping the content of the page to make sure that the content is not wider than the screen.
