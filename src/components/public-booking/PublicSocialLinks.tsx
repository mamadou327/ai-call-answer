import { Instagram, Facebook, Twitter, Youtube } from "lucide-react";

interface SocialLink {
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  twitter?: string | null;
  youtube?: string | null;
}

interface PublicSocialLinksProps {
  socials: SocialLink;
}

export const PublicSocialLinks = ({ socials }: PublicSocialLinksProps) => {
  const hasAnySocial = 
    socials.instagram || 
    socials.facebook || 
    socials.tiktok || 
    socials.twitter || 
    socials.youtube;

  if (!hasAnySocial) return null;

  const formatUrl = (url: string | null | undefined, defaultPrefix: string) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return `https://${url.startsWith(defaultPrefix) ? "" : defaultPrefix}${url}`;
  };

  return (
    <div className="flex items-center gap-3">
      {socials.instagram && (
        <a
          href={formatUrl(socials.instagram, "instagram.com/")}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors"
          aria-label="Instagram"
        >
          <Instagram className="h-5 w-5" />
        </a>
      )}
      {socials.facebook && (
        <a
          href={formatUrl(socials.facebook, "facebook.com/")}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors"
          aria-label="Facebook"
        >
          <Facebook className="h-5 w-5" />
        </a>
      )}
      {socials.tiktok && (
        <a
          href={formatUrl(socials.tiktok, "tiktok.com/@")}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors"
          aria-label="TikTok"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
          </svg>
        </a>
      )}
      {socials.twitter && (
        <a
          href={formatUrl(socials.twitter, "twitter.com/")}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors"
          aria-label="Twitter"
        >
          <Twitter className="h-5 w-5" />
        </a>
      )}
      {socials.youtube && (
        <a
          href={formatUrl(socials.youtube, "youtube.com/@")}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors"
          aria-label="YouTube"
        >
          <Youtube className="h-5 w-5" />
        </a>
      )}
    </div>
  );
};
