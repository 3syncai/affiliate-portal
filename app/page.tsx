"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronRight,
  Coins,
  FilePlus2,
  Menu,
  Megaphone,
  ShieldCheck,
  TrendingUp,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import styles from "./home.module.css";

const navigation = [
  { label: "Home", href: "#home" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Benefits", href: "#benefits" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

const benefits = [
  { icon: Coins, title: "Earn on Every Sale", description: "Get attractive commissions on a wide range of products." },
  { icon: UsersRound, title: "Track Your Network", description: "Monitor partners, sales and earnings in real time." },
  { icon: Wallet, title: "Reliable Payouts", description: "Enjoy secure and timely weekly payouts." },
];

const steps = [
  { icon: FilePlus2, title: "Join for Free", description: "Create your partner account in minutes. No investment required." },
  { icon: Megaphone, title: "Earn More by Promoting Products", description: "Share OWEG products with your network using your unique link." },
  { icon: ChartNoAxesCombined, title: "Earn Lifetime", description: "Track your sales, monitor partners and receive weekly payouts." },
];

const questions = [
  { question: "Is it free to join OWEG Partners?", answer: "Yes. You can create your partner account for free, with no upfront investment required." },
  { question: "How do I earn commissions?", answer: "Promote OWEG products using your partner link. Eligible sales earn commissions that you can track in your partner dashboard." },
  { question: "Where can I manage my network and earnings?", answer: "Sign in to your partner dashboard to view your network, track sales and commissions, and manage your earnings in one place." },
  { question: "Can I track my payouts?", answer: "Yes. Your partner dashboard lets you view your balance, withdrawal requests and payout status." },
];

function BrandLogo({ hero = false }: { hero?: boolean }) {
  return (
    <span className={`${styles.logo} ${hero ? styles.heroLogo : ""}`} aria-hidden="true">
      <span className={styles.logoName}>
        <span className={styles.logoInitial}>
          <Image src="/uploads/coin/Oweg3d-400.png" alt="" width={100} height={100} className={styles.logoMark} priority />
        </span>
        WEG<span className={styles.registered}>®</span>
      </span>
      <span className={styles.logoPartners}>PARTNERS<TrendingUp /></span>
      <span className={styles.logoTagline}>YOUR LIFETIME EARNING PARTNER.</span>
    </span>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("#home");

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#main-content">Skip to content</a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.homeLink} aria-label="OWEG Partners home"><BrandLogo /></Link>
          <nav id="home-navigation" className={`${styles.nav} ${menuOpen ? styles.navOpen : ""}`} aria-label="Main navigation">
            {navigation.map(({ label, href }) => (
              <a key={href} href={href} className={activeSection === href ? styles.activeNav : undefined} aria-current={activeSection === href ? "location" : undefined} onClick={() => { setActiveSection(href); setMenuOpen(false); }}>
                {label}
              </a>
            ))}
          </nav>
          <div className={styles.headerActions}>
            <Link href="/login" className={styles.signIn}>Sign In</Link>
            <Link href="/register" className={styles.partnerButton}>Become a Partner<ArrowRight aria-hidden="true" /></Link>
            <button type="button" className={styles.menuToggle} aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="home-navigation" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section id="home" className={styles.hero} aria-labelledby="hero-heading">
          <svg className={styles.heroWaves} viewBox="0 0 1440 550" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="home-wave" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#bcefc4" stopOpacity=".65" /><stop offset="1" stopColor="#a9e98c" stopOpacity=".6" /></linearGradient>
            </defs>
            <path d="M0 445C300 610 570 460 925 332S1320 118 1388 0H1440C1390 190 1170 310 925 370S320 610 0 475Z" fill="url(#home-wave)" />
            <path d="M0 477C325 595 600 462 962 396S1390 195 1440 80V130C1340 290 1130 375 960 416S350 610 0 492Z" fill="#d8f6df" fillOpacity=".65" />
          </svg>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <h1 id="hero-heading"><span>Your network.</span><span>Your business.</span><span className={styles.goldText}>Your lifetime income.</span></h1>
              <p>Join the <strong>OWEG Partners</strong> program to sell <strong>premium products</strong> and <strong>earn lifetime commission.</strong> Track sales, manage earnings, and grow your business with our professional tools.</p>
              <Link href="/register" className={`${styles.partnerButton} ${styles.mobileCta}`}>Become a Partner<ArrowRight aria-hidden="true" /></Link>
              <ul className={styles.trustBadges} aria-label="Partner benefits">
                {["Fast Enrolment", "Weekly Payouts", "Zero Investment"].map(label => <li key={label}><span><Check aria-hidden="true" /></span>{label}</li>)}
              </ul>
            </div>
            <div className={styles.heroVisual}>
              <div className={styles.orbits} aria-hidden="true"><span /><span /><span /></div>
              <div className={styles.heroBrand}><BrandLogo hero /></div>
              <Image src="/images/partner-home-hero.png" alt="Home appliances displayed with rising green bars and a growth arrow" width={1536} height={1024} className={styles.heroImage} priority sizes="(max-width: 760px) 100vw, 60vw" />
            </div>
          </div>
        </section>

        <section id="benefits" className={styles.benefits} aria-label="Why partner with OWEG">
          <div className={styles.benefitGrid}>
            {benefits.map(({ icon: Icon, title, description }) => (
              <article className={styles.benefitCard} key={title}>
                <span className={styles.benefitIcon}><Icon aria-hidden="true" /></span>
                <div><h2>{title}</h2><p>{description}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className={styles.howItWorks} aria-labelledby="steps-heading">
          <div className={styles.sectionHeading}>
            <h2 id="steps-heading">How <span>OWEG Partners</span> Works</h2>
            <p>Get started in just 3 simple steps and start earning.</p>
          </div>
          <ol className={styles.steps}>
            {steps.map(({ icon: Icon, title, description }, index) => (
              <li className={styles.step} key={title}>
                <span className={styles.stepNumber}>{index + 1}</span>
                <Icon className={styles.stepIcon} aria-hidden="true" />
                <div><h3>{index === 0 ? <Link href="/register">{title}</Link> : title}</h3><p>{description}</p></div>
                {index < steps.length - 1 && <ChevronRight className={styles.stepArrow} aria-hidden="true" />}
              </li>
            ))}
          </ol>
        </section>

        <section id="faq" className={styles.faq} aria-labelledby="faq-heading">
          <div className={styles.sectionHeading}><span className={styles.eyebrow}>A little more clarity</span><h2 id="faq-heading">Your questions, <span>answered.</span></h2><p>Everything you need to take your first step.</p></div>
          <div className={styles.questions}>
            {questions.map(({ question, answer }) => <details key={question}><summary>{question}<ChevronDown aria-hidden="true" /></summary><p>{answer}</p></details>)}
          </div>
        </section>

        <section id="contact" className={styles.contact} aria-labelledby="contact-heading">
          <div><span className={styles.eyebrow}>Your next chapter starts here</span><h2 id="contact-heading">Grow your business.<br /><span>Grow with OWEG.</span></h2><p>Create your free partner account to get started. Already a partner? Sign in to manage your partnership.</p></div>
          <div className={styles.contactActions}><Link href="/register" className={styles.partnerButton}>Become a Partner<ArrowRight aria-hidden="true" /></Link><Link href="/login">Already a partner? Sign in<ArrowRight aria-hidden="true" /></Link></div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div><ShieldCheck aria-hidden="true" /><span>© {new Date().getFullYear()} OWEG Partners. All rights reserved.</span></div>
        <nav aria-label="Footer navigation"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><a href="#contact">Contact</a></nav>
      </footer>
    </div>
  );
}
