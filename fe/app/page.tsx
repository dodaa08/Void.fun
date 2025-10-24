'use client'

import { useEffect, useState } from "react";

import LandingPage from "./(root)/Landing/page";

const Home = ()=>{
  const [isSmall, setIsSmall] = useState(false)

  useEffect(()=>{
    const check = ()=> setIsSmall(window.innerWidth < 1024) // below lg breakpoint
    check()
    window.addEventListener('resize', check)
    return ()=> window.removeEventListener('resize', check)
  },[])

  if (isSmall) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center bg-white dark:bg-black">
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Please use a laptop or desktop
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            This experience is optimized for larger screens. Open this site on a device with a width of 1024px or more.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div>
      <LandingPage />
    </div>
    </>
  )
}
export default Home;