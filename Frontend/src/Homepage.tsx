import { SignInButton, SignUpButton } from "@clerk/clerk-react";


const Homepage = () => {
  return (
    <div className="h-screen w-full bg-black flex flex-col gap-10 justify-center items-center">
      <h1 className="text-white text-5xl font-bold">BugBot</h1>

      <div className="flex justify-center gap-4">
        {/* Clerk SignUp Button */}
        <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
          <button className="bg-white px-5 py-2 rounded-xl hover:scale-105 transition">
            Sign Up
          </button>
        </SignUpButton>

        {/* Clerk SignIn Button */}
        <SignInButton mode="modal" forceRedirectUrl="/dashboard">
          <button className="bg-white px-5 py-2 rounded-xl hover:scale-105 transition">
            Login
          </button>
        </SignInButton>
      </div>
    </div>
  );
};

export default Homepage;
