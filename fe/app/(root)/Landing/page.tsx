import Navbar from "@/app/components/Navbar";
import Hero from "@/app/components/hero";

const LandingPage = ()=>{

    return (
        <>
        <div className="bg-black w-full h-screen">
                 <Navbar />
  
            <div className="">

          <div className="flex-1 flex justify-center ml-16">
            <Hero />
          </div>    
            </div>
          
        </div>
        </>
    )
}

export default LandingPage;
