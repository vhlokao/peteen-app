-- CreateTable
CREATE TABLE "invite_visits" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "visitorKey" VARCHAR(64) NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "convertedUserId" TEXT,
    "signedUpAt" TIMESTAMP(3),
    "petCreatedAt" TIMESTAMP(3),
    "requestCreatedAt" TIMESTAMP(3),
    "serviceCompletedAt" TIMESTAMP(3),

    CONSTRAINT "invite_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invite_visits_professionalId_openedAt_idx" ON "invite_visits"("professionalId", "openedAt");

-- CreateIndex
CREATE INDEX "invite_visits_convertedUserId_idx" ON "invite_visits"("convertedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "invite_visits_visitorKey_professionalId_key" ON "invite_visits"("visitorKey", "professionalId");

-- AddForeignKey
ALTER TABLE "invite_visits" ADD CONSTRAINT "invite_visits_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_visits" ADD CONSTRAINT "invite_visits_convertedUserId_fkey" FOREIGN KEY ("convertedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

