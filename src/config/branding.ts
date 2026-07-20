export interface SocialLink {
  href: string;
  title: string;
  ariaLabel: string;
  icon: "github" | "facebook" | "email" | "website";
}

export const APP_SOCIAL_LINKS: SocialLink[] = [
  {
    href: "https://github.com/hmduongdl/Purrdora",
    title: "GitHub · hmduongdl/Purrdora",
    ariaLabel: "Open Purrdora on GitHub",
    icon: "github",
  },
  {
    href: "https://www.facebook.com/hmd.stewiclez",
    title: "Facebook",
    ariaLabel: "Open Facebook profile",
    icon: "facebook",
  },
  {
    href: "mailto:hoanglong.workdl@gmail.com",
    title: "Email · hoanglong.workdl@gmail.com",
    ariaLabel: "Send an email to hoanglong.workdl@gmail.com",
    icon: "email",
  },
  {
    href: "https://sp-hoangminhduong.id.vn/",
    title: "Website",
    ariaLabel: "Open personal website",
    icon: "website",
  },
];

export const APP_VERSION = "0.2.7.27";
export const APP_NAME = "Purrdora";
export const APP_REPO = "https://github.com/hmduongdl/Purrdora";
