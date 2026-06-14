import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import type { InfoBoxContent, InfoBoxCharacter } from "@/lib/types"

interface InfoBoxProps {
  data: InfoBoxContent
  charAvatars?: Record<string, string>
}

function CustomAccordionTrigger({ children, className, ...props }: React.ComponentProps<typeof AccordionTrigger>) {
  return (
    <AccordionTrigger
      className={cn(
        "group/accordion-trigger relative flex flex-1 items-center justify-between rounded-lg border border-transparent py-2 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:after:border-ring disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon data-slot="accordion-trigger-icon" className="pointer-events-none shrink-0 size-4 text-muted-foreground group-aria-expanded/accordion-trigger:hidden" />
      <ChevronUpIcon data-slot="accordion-trigger-icon" className="pointer-events-none hidden shrink-0 size-4 text-muted-foreground group-aria-expanded/accordion-trigger:inline" />
    </AccordionTrigger>
  )
}

function CustomAccordionContent({ children, className, ...props }: React.ComponentProps<typeof AccordionContent>) {
  return (
    <AccordionContent
      className={cn("overflow-hidden text-sm data-open:animate-accordion-down data-closed:animate-accordion-up", className)}
      {...props}
    >
      <div
        className={cn(
          "h-(--radix-accordion-content-height) pt-0 pb-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
          className
        )}
      >
        {children}
      </div>
    </AccordionContent>
  )
}

export function InfoBox({ data, charAvatars = {} }: InfoBoxProps) {
  const characters = data.characters || []

  if (characters.length === 0) return null

  return (
    <div className={cn(
      "mx-auto my-2 w-full max-w-[80%] rounded-xl border border-amber-500/30 bg-amber-50/10 dark:bg-amber-900/10",
      "animate-in fade-in zoom-in-95 duration-200"
    )}>
      <Accordion type="multiple" className="w-full">
        {characters.map((character: InfoBoxCharacter) => {
          const avatarUrl = charAvatars[character.name]
          const hasItems = character.items && character.items.length > 0

          if (!hasItems) return null

          return (
            <AccordionItem key={character.name} value={character.name} className="border-amber-500/20 last:border-0">
              <CustomAccordionTrigger className="px-3 py-2 bg-transparent hover:bg-amber-500/5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Avatar className="size-7 shrink-0">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="text-xs">
                      {(character.name || "?")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate font-medium text-amber-700 dark:text-amber-300">
                    {character.name}
                  </span>
                </div>
              </CustomAccordionTrigger>
              <CustomAccordionContent className="px-3">
                <div className="space-y-3 pb-2">
                  {character.items.map((item, idx) => (
                    <div key={idx} className="rounded-lg bg-white/50 dark:bg-black/20 p-3 border border-amber-500/10">
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 text-sm font-semibold text-amber-600 dark:text-amber-400">
                          {item.label}
                        </span>
                        <p className="flex-1 text-sm text-foreground/80 whitespace-pre-wrap break-words leading-relaxed">
                          {item.value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CustomAccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}