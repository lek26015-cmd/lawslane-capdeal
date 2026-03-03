const fs = require('fs');
const file = 'src/components/layout/header.tsx';
let content = fs.readFileSync(file, 'utf8');

// Simplistic replacement to clear out nav items except home and cap&deal
const desktopNavRegex = /<nav className="flex items-center gap-4 text-sm font-medium whitespace-nowrap">[\s\S]*?<\/nav>/;
const newDesktopNav = `<nav className="flex items-center gap-4 text-sm font-medium whitespace-nowrap">
            <Link href={getMainLink('/services/contracts/screenshot', domainType)} className={pathname.startsWith(\`/services/contracts/screenshot\`) ? activeNavLinkClasses : navLinkClasses}>
              <span className="flex items-center gap-1"><Camera className="h-4 w-4" />{t('capAndDeal')}</span>
            </Link>
          </nav>`;

content = content.replace(desktopNavRegex, newDesktopNav);

const mobileNavRegex = /<nav className="flex flex-col gap-4 text-lg mt-6">[\s\S]*?<\/nav>/;
const newMobileNav = `<nav className="flex flex-col gap-4 text-lg mt-6">
                  <Link href={getMainLink('/', domainType, !isMounted)} className="hover:text-primary">{t('home')}</Link>
                  <Link href={getMainLink('/services/contracts/screenshot', domainType)} className="flex items-center gap-2 hover:text-primary"><Camera className="h-5 w-5" />{t('capAndDeal')}</Link>
                </nav>`;

content = content.replace(mobileNavRegex, newMobileNav);

fs.writeFileSync(file, content);
console.log("Header pruned");
