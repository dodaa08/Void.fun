import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CasinoSimple } from "../target/types/casino_simple";
import { expect } from "chai";
import bs58 from "bs58";

describe("casino-simple", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.CasinoSimple as Program<CasinoSimple>;
  const provider = anchor.getProvider();

  it("Complete casino flow with real authority key", async () => {
    // Use your actual authority keypair from environment
    const authority = anchor.web3.Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(process.env.SOL_PRIVATE_KEY || "[]"))
    );
    const user = anchor.web3.Keypair.generate();
    
    // Airdrop SOL to both accounts
    await provider.connection.requestAirdrop(authority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(user.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    
    // Wait for airdrop to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Derive PDAs
    const [casinoPda, casinoBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("casino"), authority.publicKey.toBuffer()],
      program.programId
    );

    const [userAccountPda, userAccountBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user"), user.publicKey.toBuffer(), casinoPda.toBuffer()],
      program.programId
    );
    
    console.log("Casino PDA:", casinoPda.toString());
    console.log("User Account PDA:", userAccountPda.toString());

    // 1. Initialize casino
    const initTx = await program.methods
      .initializeCasino()
      .accounts({
        casino: casinoPda,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    console.log("Initialize casino signature:", initTx);

    // Verify casino was initialized
    const casino = await program.account.casino.fetch(casinoPda);
    expect(casino.authority.toString()).to.equal(authority.publicKey.toString());
    expect(casino.totalDeposits.toNumber()).to.equal(0);
    expect(casino.totalWithdrawals.toNumber()).to.equal(0);

    // 2. Deposit SOL
    const depositAmount = anchor.web3.LAMPORTS_PER_SOL; // 1 SOL
    const depositTx = await program.methods
      .deposit(new anchor.BN(depositAmount))
      .accounts({
        casino: casinoPda,
        userAccount: userAccountPda,
        user: user.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    console.log("Deposit signature:", depositTx);

    // Verify user account was created and updated
    const userAccount = await program.account.userAccount.fetch(userAccountPda);
    expect(userAccount.balance.toNumber()).to.equal(depositAmount);
    expect(userAccount.totalDeposits.toNumber()).to.equal(depositAmount);

    // Verify casino stats updated
    const updatedCasino = await program.account.casino.fetch(casinoPda);
    expect(updatedCasino.totalDeposits.toNumber()).to.equal(depositAmount);

    // 3. Withdraw SOL
    const withdrawAmount = anchor.web3.LAMPORTS_PER_SOL / 2; // 0.5 SOL
    const withdrawTx = await program.methods
      .withdraw(new anchor.BN(withdrawAmount))
      .accounts({
        casino: casinoPda,
        userAccount: userAccountPda,
        user: user.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    console.log("Withdraw signature:", withdrawTx);

    // Verify user account was updated
    const updatedUserAccount = await program.account.userAccount.fetch(userAccountPda);
    expect(updatedUserAccount.balance.toNumber()).to.equal(anchor.web3.LAMPORTS_PER_SOL / 2);
    expect(updatedUserAccount.totalWithdrawals.toNumber()).to.equal(withdrawAmount);

    // Verify casino stats updated
    const finalCasino = await program.account.casino.fetch(casinoPda);
    expect(finalCasino.totalWithdrawals.toNumber()).to.equal(withdrawAmount);

    // 4. Test insufficient balance error
    const excessiveAmount = anchor.web3.LAMPORTS_PER_SOL * 2; // 2 SOL
    try {
      await program.methods
        .withdraw(new anchor.BN(excessiveAmount))
        .accounts({
          casino: casinoPda,
          userAccount: userAccountPda,
          user: user.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      // Should not reach here
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.message).to.include("InsufficientBalance");
    }

    // 5. Emergency withdraw (authority only)
    const emergencyTx = await program.methods
      .emergencyWithdraw()
      .accounts({
        casino: casinoPda,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    console.log("Emergency withdraw signature:", emergencyTx);
  });

  it("Test casino balance and user balance queries", async () => {
    // Use your actual authority keypair
    const authority = anchor.web3.Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(process.env.SOL_PRIVATE_KEY || "[]"))
    );
    const user = anchor.web3.Keypair.generate();
    
    // Airdrop SOL to both accounts
    await provider.connection.requestAirdrop(authority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(user.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Derive PDAs
    const [casinoPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("casino"), authority.publicKey.toBuffer()],
      program.programId
    );

    const [userAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user"), user.publicKey.toBuffer(), casinoPda.toBuffer()],
      program.programId
    );

    // Initialize casino
    await program.methods
      .initializeCasino()
      .accounts({
        casino: casinoPda,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    // Check casino balance before deposit
    const casinoBalanceBefore = await provider.connection.getBalance(casinoPda);
    console.log("Casino balance before deposit:", casinoBalanceBefore / anchor.web3.LAMPORTS_PER_SOL, "SOL");

    // Deposit 1 SOL
    const depositAmount = anchor.web3.LAMPORTS_PER_SOL;
    await program.methods
      .deposit(new anchor.BN(depositAmount))
      .accounts({
        casino: casinoPda,
        userAccount: userAccountPda,
        user: user.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    // Check casino balance after deposit
    const casinoBalanceAfter = await provider.connection.getBalance(casinoPda);
    console.log("Casino balance after deposit:", casinoBalanceAfter / anchor.web3.LAMPORTS_PER_SOL, "SOL");
    expect(casinoBalanceAfter).to.be.greaterThan(casinoBalanceBefore);

    // Check user account balance
    const userAccount = await program.account.userAccount.fetch(userAccountPda);
    console.log("User balance:", userAccount.balance.toNumber() / anchor.web3.LAMPORTS_PER_SOL, "SOL");
    expect(userAccount.balance.toNumber()).to.equal(depositAmount);
  });

  it("Test multiple deposits and withdrawals", async () => {
    // Use your actual authority keypair
    const authority = anchor.web3.Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(process.env.SOL_PRIVATE_KEY || "[]"))
    );
    const user = anchor.web3.Keypair.generate();
    
    // Airdrop SOL to both accounts
    await provider.connection.requestAirdrop(authority.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(user.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Derive PDAs
    const [casinoPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("casino"), authority.publicKey.toBuffer()],
      program.programId
    );

    const [userAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user"), user.publicKey.toBuffer(), casinoPda.toBuffer()],
      program.programId
    );

    // Initialize casino
    await program.methods
      .initializeCasino()
      .accounts({
        casino: casinoPda,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    // Multiple deposits
    const deposit1 = anchor.web3.LAMPORTS_PER_SOL; // 1 SOL
    const deposit2 = anchor.web3.LAMPORTS_PER_SOL / 2; // 0.5 SOL
    
    await program.methods
      .deposit(new anchor.BN(deposit1))
      .accounts({
        casino: casinoPda,
        userAccount: userAccountPda,
        user: user.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    await program.methods
      .deposit(new anchor.BN(deposit2))
      .accounts({
        casino: casinoPda,
        userAccount: userAccountPda,
        user: user.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    // Check total deposits
    const userAccount = await program.account.userAccount.fetch(userAccountPda);
    const expectedTotal = deposit1 + deposit2;
    expect(userAccount.totalDeposits.toNumber()).to.equal(expectedTotal);
    expect(userAccount.balance.toNumber()).to.equal(expectedTotal);

    // Multiple withdrawals
    const withdraw1 = anchor.web3.LAMPORTS_PER_SOL / 4; // 0.25 SOL
    const withdraw2 = anchor.web3.LAMPORTS_PER_SOL / 4; // 0.25 SOL
    
    await program.methods
      .withdraw(new anchor.BN(withdraw1))
      .accounts({
        casino: casinoPda,
        userAccount: userAccountPda,
        user: user.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    await program.methods
      .withdraw(new anchor.BN(withdraw2))
      .accounts({
        casino: casinoPda,
        userAccount: userAccountPda,
        user: user.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    // Check final balance
    const finalUserAccount = await program.account.userAccount.fetch(userAccountPda);
    const expectedFinalBalance = expectedTotal - withdraw1 - withdraw2;
    expect(finalUserAccount.balance.toNumber()).to.equal(expectedFinalBalance);
    expect(finalUserAccount.totalWithdrawals.toNumber()).to.equal(withdraw1 + withdraw2);
  });
});