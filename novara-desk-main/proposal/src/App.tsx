import { ProposalCover } from '../components/proposal/ProposalCover'
import { ProposalPage02 } from '../components/proposal/ProposalPage02'
import { ProposalPage03 } from '../components/proposal/ProposalPage03'
import { ProposalPage04 } from '../components/proposal/ProposalPage04'
import { ProposalPage05 } from '../components/proposal/ProposalPage05'
import { ProposalPage06 } from '../components/proposal/ProposalPage06'
import { ProposalPage07 } from '../components/proposal/ProposalPage07'
import { ProposalPage08 } from '../components/proposal/ProposalPage08'
import { ProposalPage09 } from '../components/proposal/ProposalPage09'
import { ProposalPage10 } from '../components/proposal/ProposalPage10'
import { ProposalPage11 } from '../components/proposal/ProposalPage11'

export default function App() {
  return (
    <div className="min-h-screen bg-[#0D1A1F] flex flex-col items-center justify-center p-4 gap-4">
      <div className="w-full max-w-[1920px]">
        <ProposalCover
          title="RevOps"
          subtitle="Proposal"
          description="Built for [Client Name]. Most founders are not short on leads. They are losing revenue between the lead and the close, and they do not know where. This proposal finds the leak and fixes it."
          clientName="[Client Name]"
          preparedBy="Jayson Kandiah"
          pageNumber={1}
          tags={[
            { text: 'Diagnose' },
            { text: 'Fix' },
            { text: 'Automate' },
            { text: 'Convert' },
            { text: 'Scale' },
          ]}
        />
      </div>
      <div className="w-full max-w-[1920px]">
        <ProposalPage02 />
      </div>
      <div className="w-full max-w-[1920px]">
        <ProposalPage03 />
      </div>
      <div className="w-full max-w-[1920px]">
        <ProposalPage04 />
      </div>
      <div className="w-full max-w-[1920px]">
        <ProposalPage05 />
      </div>
      <div className="w-full max-w-[1920px]">
        <ProposalPage06 />
      </div>
      <div className="w-full max-w-[1920px]">
        <ProposalPage07 />
      </div>
      <div className="w-full max-w-[1920px]">
        <ProposalPage08 />
      </div>
      <div className="w-full max-w-[1920px]">
        <ProposalPage09 />
      </div>
      <div className="w-full max-w-[1920px]">
        <ProposalPage10 />
      </div>
      <div className="w-full max-w-[1920px]">
        <ProposalPage11 />
      </div>
    </div>
  )
}
