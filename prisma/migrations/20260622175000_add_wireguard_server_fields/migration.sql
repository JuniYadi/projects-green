-- AlterTable: add WireGuard fields to VpnServer
ALTER TABLE "VpnServer" ADD COLUMN     "wireGuardPublicKey" TEXT,
ADD COLUMN     "wireGuardSubnet" TEXT;

-- AlterEnum: add WIREGUARD to VpnProvider
ALTER TYPE "VpnProvider" ADD VALUE 'WIREGUARD';
