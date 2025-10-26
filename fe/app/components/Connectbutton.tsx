import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';


export default function Connectbutton() {
  return (
    <div className="flex items-center">
      {/* <h1>Click below to connect your wallet with Solana</h1> */}
      <WalletMultiButton />
    </div>
  );
}