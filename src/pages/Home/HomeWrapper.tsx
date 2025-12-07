import React from 'react';
import FirstSection from './FirstSection';
import KeyCommitments from './KeyCommitments';
import ProductShowcase from './ProductShowcase';
import FAQSection from './FAQSection.tsx';
import WhatsAppCTA from '../../components/WhatsAppCTA.tsx';

const HomeWrapper: React.FC = () => {
  return (
    <>

      <FirstSection />

      <KeyCommitments/>

      <WhatsAppCTA bgColor="bg-gray-100"/>

      <hr className='border-gray-200/50'/>

      <ProductShowcase />

      <WhatsAppCTA />

      <FAQSection />

      <WhatsAppCTA />

    </>
  );
};

export default HomeWrapper;