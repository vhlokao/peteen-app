"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, Shield, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fadeIn, slideUp, staggerContainer, staggerItem } from "@/lib/motion/presets";

const pillars = [
  {
    icon: Shield,
    title: "Confiança verificável",
    description:
      "Reputação construída com histórico real, recorrência e validação social — nunca comprada.",
  },
  {
    icon: Heart,
    title: "Segurança emocional",
    description:
      "Encontre profissionais no seu bairro com contexto claro para o cuidado do seu pet.",
  },
  {
    icon: Users,
    title: "Relações duradouras",
    description:
      "Recorrência vale mais que volume. Construa vínculos de longo prazo com quem cuida do seu pet.",
  },
];

export default function LandingPage() {
  return (
    <div className="page-container flex flex-col gap-12 pb-16 pt-6 sm:gap-16 sm:pt-10">
      <motion.section
        className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center"
        variants={fadeIn}
        initial="hidden"
        animate="visible"
      >
        <Badge variant="trust">Infraestrutura de confiança pet</Badge>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
          Cuidado pet com confiança que se constrói ao longo do tempo
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          O Peteen conecta tutores e profissionais através de reputação
          contextual, recorrência e uma rede local de confiança.
        </p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/tutor"
            className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}
          >
            Encontrar profissional
          </Link>
          <Link
            href="/professional"
            className={buttonVariants({ variant: "outline", size: "lg", className: "w-full sm:w-auto" })}
          >
            Sou profissional
          </Link>
        </div>
      </motion.section>

      <motion.section
        className="grid gap-4 sm:grid-cols-3"
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-40px" }}
      >
        {pillars.map((pillar) => (
          <motion.div key={pillar.title} variants={staggerItem}>
            <Card className="h-full border-border/80 shadow-sm">
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <pillar.icon className="size-5" />
                </div>
                <CardTitle className="text-lg">{pillar.title}</CardTitle>
                <CardDescription className="leading-relaxed">
                  {pillar.description}
                </CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </motion.div>
        ))}
      </motion.section>

      <motion.section
        className="rounded-2xl border border-border/80 bg-secondary/40 p-6 text-center sm:p-10"
        variants={slideUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <p className="font-heading text-xl font-semibold sm:text-2xl">
          Não somos um marketplace genérico.
        </p>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground sm:text-base">
          Competimos por confiança, densidade local e relações recorrentes — não
          por preço ou volume de anúncios.
        </p>
      </motion.section>
    </div>
  );
}
