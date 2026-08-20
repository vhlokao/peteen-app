-- CreateTable
CREATE TABLE "notification_reads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationKey" VARCHAR(200) NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_reads_userId_readAt_idx" ON "notification_reads"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_reads_userId_notificationKey_key" ON "notification_reads"("userId", "notificationKey");

-- AddForeignKey
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

